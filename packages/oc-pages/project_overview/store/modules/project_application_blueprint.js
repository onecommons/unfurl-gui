import axios from '~/lib/utils/axios_utils'
import {uniq} from 'lodash'
import {isConfigurable} from 'oc_vue_shared/client_utils/resource_types'
import {fetchUserAccessToken} from 'oc_vue_shared/client_utils/user'
import {fetchProjectInfo, fetchBranches} from '../../../vue_shared/client_utils/projects'
import _ from 'lodash'
import Vue from 'vue'

const state = () => ({loaded: false, callbacks: [], clean: true})
const mutations = {
    setProjectState(state, {key, value}) {
        Vue.set(state, key, {...state[key], ...value})
        state.clean = false
    },

    resetProjectState(state) {
        for(const key in state) {
            let value = null
            switch(key) {
                case 'loaded':
                    value = false; break
                case 'callbacks':
                    value = []; break
                case 'clean':
                    value = true; break
            }
            Vue.set(state, key, value)
        }
    },
    
    loaded(state, status) {
        state.loaded = status
        state.callbacks.forEach(cb => {if(typeof cb == 'function') {cb()} else throw new Error('application blueprint callback is not a function')})  

        state.callbacks = []
    },
    onApplicationBlueprintLoaded(state, cb) { if(state.loaded) {cb()} else state.callbacks.push(cb) }

}
const actions = {
    async fetchProject({commit, dispatch, rootGetters}, params) {
        const {projectPath, fullPath, fetchPolicy, projectGlobal} = params
        commit('loaded', false)

        const project = await fetchProjectInfo(encodeURIComponent(projectPath))
        const branch = project.default_branch

        const latestCommit = (await fetchBranches(project.id))
            ?.find(b => b.name == branch)
            ?.commit?.id

        const username = rootGetters.getUsername
        const password = await fetchUserAccessToken()

        let exportUrl = `${rootGetters.unfurlServicesUrl}/export?format=blueprint`
        exportUrl += `&username=${username}`
        exportUrl += `&password=${password}`
        exportUrl += `&branch=${branch}`
        exportUrl += `&auth_project=${encodeURIComponent(projectPath)}`
        exportUrl += `&latest_commit=${latestCommit}`

        const {data} = await axios.get(exportUrl)

        // TODO handle errors

        const root = data
        root.projectGlobal = projectGlobal

        dispatch('useProjectState', {projectPath, root})
        commit('loaded', true)
    },

    useProjectState({state, commit, getters}, {projectPath, root, shouldMerge}) {
        if(!projectPath) {console.warn('projectPath is not set')}
        console?.assert(root && typeof root == 'object', 'Cannot use project state', root)
        if(!(state.clean || shouldMerge)) {
            commit('resetProjectState')
            commit('clearRepositoryDependencies', null, {root: true})
        }

        if(state.clean && projectPath) {
            commit('addRepositoryDependencies', [projectPath], {root: true})
        }
        
        let transforms

        function normalizeProperties(properties) {
            if(!properties || typeof properties != 'object') {
                return []
            } else if (Array.isArray(properties)) {
                return properties
            } else {
                console.warn('@normalizeProperties: Converting properties into an array', properties)
                return Object.entries(properties)
                    .reduce((acc, [name, value])  => {acc.push({name, value}); return acc}, [])
            }
        }

        function normalizeDependencies(dependencies) {
            if(!dependencies || typeof dependencies != 'object') {
                return []
            } else if (Array.isArray(dependencies)) {
                return dependencies
            } else {
                console.warn('@normalizeDependencies: Converting dependencies into an array', dependencies)
                return Object.entries(dependencies)
                    .reduce((acc, [name, value])  => {acc.push({name, value}); return acc}, [])
            }
        }

        transforms = {
            ResourceTemplate(resourceTemplate) {
                resourceTemplate.dependencies = _.uniqBy(normalizeDependencies(resourceTemplate.dependencies), 'name')
                resourceTemplate.properties = _.uniqBy(normalizeProperties(resourceTemplate.properties), 'name')

                const {properties, computedProperties} = getters.groupProperties(resourceTemplate)
                resourceTemplate.properties = properties
                resourceTemplate.computedProperties = computedProperties

                for(const generatedDep of getters.getMissingDependencies(resourceTemplate)) {
                    resourceTemplate.dependencies.push(generatedDep)
                }
                for(const generatedProp of getters.getMissingProperties(resourceTemplate)) {
                    resourceTemplate.properties.push(generatedProp)
                }

                for(const prop of resourceTemplate.properties) {
                    if(prop.value == '<<REDACTED>>') prop.value = null
                    if(prop.value?.secret) {
                        prop.value.get_env = prop.value.secret
                    }
                }

                if(!resourceTemplate.visibility) resourceTemplate.visibility = 'inherit'
                resourceTemplate.dependencies.forEach(dep => {
                    if(!dep.constraint.visibility) dep.constraint.visibility = 'visible'
                })
                resourceTemplate.__typename = 'ResourceTemplate'
            },
            DeploymentTemplate(deploymentTemplate, root) {
                if(!deploymentTemplate.resourceTemplates) {
                    deploymentTemplate.resourceTemplates = []
                }
                if(deploymentTemplate.ResourceTemplate) {
                    Object.values(deploymentTemplate.ResourceTemplate).forEach(transforms.ResourceTemplate)
                }
                if(projectPath && !deploymentTemplate.projectPath) {
                    deploymentTemplate.projectPath = projectPath
                }

                deploymentTemplate.__typename = 'DeploymentTemplate'
            },
            ApplicationBlueprint(applicationBlueprint) {
                if(!applicationBlueprint.title) {
                    applicationBlueprint.title = applicationBlueprint.name
                }
                applicationBlueprint.__typename = 'ApplicationBlueprint'
            },
            ResourceType(resourceType) {
                if(!resourceType.title) resourceType.title = resourceType.name
                resourceType.__typename = 'ResourceType'
            },
            Resource(resource, root) {
                if(!resource.dependencies) resource.dependencies = resource.connections || []
                if(!resource.attributes) resource.attributes = []
                if(!resource.visibility) resource.visibility = 'inherit'
                resource.dependencies.forEach(dep => {
                    if(!dep.constraint.visibility) dep.constraint.visibility = 'visible'
                })

                for(const attribute of resource.attributes) {
                    if(attribute.value?.secret) {
                        attribute.value.get_env = attribute.value.secret
                    }
                }

                resource.__typename = 'Resource'

                // infer types from template when they're not available
                if(!resource.type && resource.template) {
                    try {
                        resource.type = root['ResourceTemplate'][resource.template].type
                    } catch(e) {}
                }
            },
            Deployment(deployment) {
                const dt = getters.resolveDeploymentTemplate(deployment.deploymentTemplate)
                deployment.projectPath = dt?.projectPath
            },
            DeploymentEnvironment(de, root) {
                for(const connection of Object.values(de.connections)) {
                    const providerType = connection?.type
                    if(!root.ResourceTemplate) { root.ResourceTemplate = {} }

                    // intentionally not cloning
                    // we want to normalize this record in both places
                    root.ResourceTemplate[connection.name] = connection
                }
            },
            repositories(entry) {
                const url = new URL(entry.url)
                const origin = url.origin

                if(window.location.origin == origin) {
                    commit('addRepositoryDependencies', [url.pathname.slice(1).replace('.git', '')], {root: true})
                }
            }
        }

        // guarunteed ordering
        const ordering = uniq(['ResourceType', 'DefaultTemplate', 'DeploymentEnvironment', 'ResourceTemplate', 'DeploymentTemplate', 'Deployment'].concat(Object.keys(root)))

        for(const key of ordering) {
            const value = root[key]
            if(!value || typeof value != 'object') continue
            if(!Object.isFrozen(value) && typeof transforms[key] == 'function')
                Object.values(value).forEach(entry => {if(typeof entry == 'object' && !Object.isFrozen(entry)) {transforms[key](entry, root)}})

            // commit so we can use our resolvers while normalizing
            if(key == 'ResourceType') {
                commit('setProjectState', {key, value})
            }
        }
        if(root.ApplicationBlueprint) {
            commit('setProjectState', {key: 'applicationBlueprint', value: Object.values(root.ApplicationBlueprint)[0]})
        }

        // second iteration to avoid mutating committed
        for(const key of ordering) {
            if(key == 'ResourceType') continue
            const value = root[key]
            commit('setProjectState', {key, value})
        }
    }
    
}

function storeResolver(typename) {
    return function(state) {
        const dictionary = typeof typename == 'string'? state[typename]: state
        if(!dictionary) return () => null
        return function(...args) {
            let name = args[0]
            let entry
            if(typeof typename == 'function') {
                entry = typename(state, ...args)
            } else {
                entry = dictionary[name]
            }
            if(entry) {
                let result
                if (typename === 'DeploymentTemplate') {
                    // TODO maybe there is another way to do this
                    // NOTE entry might be frozen, so here I assign the new field first
                    result = {
                        ...result,
                        _primary: state['ResourceTemplate'][entry.primary]
                    }
                    result = Object.assign(result, entry)
                } else if (typename === 'ResourceTemplate') {
                    // TODO maybe there is another way to do this
                    // NOTE entry might be frozen, so here I assign the new field first
                    result = {
                        ...result,
                        _type: state['ResourceTemplate'][entry.type]
                    }
                    result = Object.assign(result, entry)
                }
                else result = entry
                return Object.freeze(result)
            } else {
                return null
            }
        }
    }
}

const getters = {
    getApplicationRoot(state) {return state},
    resolveResourceType: storeResolver('ResourceType'),
    resolveResourceTemplate: storeResolver('ResourceTemplate'),
    resolveDeploymentTemplate: storeResolver('DeploymentTemplate'),
    resolveLocalResourceTemplate: storeResolver(
        function(state, deploymentTemplate, name) {
            try {
                return state.DeploymentTemplate[deploymentTemplate].ResourceTemplate[name]
            } catch(e) {return null}
        }
    ),
    resolveResource(state) {
        return name => {
            if(!name) return
            let rt = state['Resource'][name]
            if(!rt && !name?.startsWith('::')) {
                rt = state['Resource'][`::${name}`]
            }
            return rt
        }
    },
    resolveDeployment(state) { return name =>  state['Deployment'][name] },
    dependenciesFromResourceType(_, getters) {
        return function(resourceTypeName) {
            let resourceType
            if(typeof resourceTypeName == 'string') {
                resourceType = getters.resolveResourceType(resourceTypeName)
            } else { resourceType = resourceTypeName }

            if(!resourceType?.requirements) return []
            return resourceType.requirements.map(req => ({
                name: req.name,
                constraint: req,
                match: null,
                target: null,
                __typename: 'Dependency'
            }))
        }
    },
    // TODO use names instead of titles
    propertiesFromResourceType(_, getters) {
        return function(resourceTypeName) {
            let resourceType
            if(typeof resourceTypeName == 'string') {
                resourceType = getters.resolveResourceType(resourceTypeName)
            } else { resourceType = resourceTypeName }

            if(!resourceType?.inputsSchema?.properties) return []
            const result = Object.entries(resourceType.inputsSchema.properties).map(([key, schemaEntry]) => ({
                name: key,
                value: null
            }))
            return result
        }
    },
    getMissingDependencies(_, getters) {
        return function(resourceTemplate) {
            const generatedDependencies = getters.dependenciesFromResourceType(resourceTemplate.type)
            if(generatedDependencies.length == resourceTemplate.dependencies?.length) {
                return [] // assuming they're correct
            }
            if(!resourceTemplate.dependencies?.length) {
                return generatedDependencies
            }
            const result = []
            for(const generated of generatedDependencies) {
                if(!resourceTemplate.dependencies.some(dep => dep.name == generated.name)) {
                    result.push(generated)
                }
            }
            return result
        }
    },
    getMissingProperties(_, getters) {
        return function(resourceTemplate) {
            const generatedProperties = getters.propertiesFromResourceType(resourceTemplate.type)
            if(generatedProperties.length == resourceTemplate.properties?.length) {
                return [] // assuming they're correct
            }
            if(!resourceTemplate.properties?.length) {
                return generatedProperties
            }
            const result = []
            for(const generated of generatedProperties) {
                if(!resourceTemplate.properties.some(prop => prop.name == generated.name)) {
                    result.push(generated)
                }
            }
            return result
        }
    },
    groupProperties(_, getters) {
        return function(resourceTemplate) {
            const type = getters.resolveResourceType(resourceTemplate.type)
            const groups = {properties: [], computedProperties: []}

            for(const property of resourceTemplate.properties || []) {
                if(type?.computedPropertiesSchema?.properties?.hasOwnProperty(property.name)) {
                    groups.computedProperties.push(property)
                } else {
                    // preserve arbitrary properties
                    groups.properties.push(property)
                }
            }
            return groups
        }
    },
    getApplicationBlueprint(state) { return state.applicationBlueprint },

    getResources(state) {return Object.values(state.Resource || {})},
    getDeployment(state) {return Object.values(state.Deployment || {})[0]},

    applicationBlueprintIsLoaded(state) {return state.loaded},
    lookupConfigurableTypes(state, _a, _b, rootGetters) {
        return function(environment) {
            //const resolver = rootGetters.resolveResourceTypeFromAvailable // didn't work for some reason
            const resolver = rootGetters.environmentResolveResourceType.bind(null, environment)
            return Object.values(state.ResourceType).filter(rt => isConfigurable(rt, environment, resolver))
        }
    },

    getTemplatesList(state) {
        return Object.values(state.DeploymentTemplate)
            ?.filter(dt => dt && dt.visibility != 'hidden')
    },

    requirementsForType(_, getters) {
        return function(_rt) {
            const rt = getters.resolveResourceType(_rt?.name || _rt)
            return rt.requirements
        }
    },

    inputsSchemaForType(_, getters) {
        return function(_rt) {
            const rt = getters.resolveResourceType(_rt?.name || _rt)
            return rt.inputsSchema
        }
    },

    outputsSchemaForType(_, getters) {
        return function(_rt) {
            const rt = getters.resolveResourceType(_rt?.name || _rt)
            return rt.outputsSchema
        }
    },
}


export default {state, mutations, actions, getters}
