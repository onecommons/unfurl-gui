import {uniq} from 'lodash'
import {unfurlServerExport} from 'oc_vue_shared/client_utils/unfurl-server'
import {localNormalize} from 'oc_vue_shared/lib/normalize'
import {applyInputsSchema, applyRequirementsFilter} from 'oc_vue_shared/lib/node-filter'
import { repoToExportParams, fetchTypeRepositories, unfurlServerGetTypes } from  'oc_vue_shared/client_utils/unfurl-server'
import _ from 'lodash'
import Vue from 'vue'

function computeDependencyMap(root) {
    try {
        const res = Object.values(root.ResourceTemplate)
            .map(
                rt => rt.dependencies
                .filter(req => req.match)
                .map(req => ({[req.match]: [rt, req.name]}))
            ).flat()

        return Object.assign({}, ...res)
    } catch(e) {console.error(e)}
}

function lookupAncestors(rt, root, mutable=false) {
    let computedDependencyMap = mutable? root.computedDependencyMap: null
    if(!computedDependencyMap) {
        computedDependencyMap = computeDependencyMap(root)
        if(mutable)  {
            root.computedDependencyMap = computedDependencyMap
        }
    }

    let current = rt, matchEntry
    const reverseAncestors = []
    while(matchEntry = computedDependencyMap[current.name]) {
        const [rt, req] = matchEntry
        reverseAncestors.push(matchEntry)
        current = rt
    }

    return reverseAncestors.reverse()
}

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
    async fetchProject({state, commit, dispatch, rootGetters}, params) {
        const {projectPath, projectGlobal, shouldMerge} = {shouldMerge: false, ...params}
        const format = 'blueprint'
        commit('loaded', false)

        let branch
        const deployment = Object.values(state.Deployment || {})[0]

        if(deployment) {
            try {
                branch = deployment.packages[projectPath].version
            } catch(e) {}
        }

        let root
        try {
            root = await unfurlServerExport({
                format,
                projectPath,
                sendCredentials: !(rootGetters.getGlobalVars?.projectPath == projectPath && rootGetters.getGlobalVars?.projectVisibility == 'public'),
                branch
            })
        } catch(e) {
            // TODO handle this from the caller
            const responseData = e.response?.data
            commit(
                'createError',
                {
                    message: `An error occurred while exporting ${projectPath}`,
                    context: {
                        error: e.message,
                        projectPath,
                        format,
                        ...(typeof responseData == 'object'? responseData: null)
                    },
                    severity: 'critical',
                }
            )

            return
        }


        root.projectGlobal = projectGlobal

        if(root.ResourceType) {
            Object.values(root.ResourceType).forEach(resourceType => {
                localNormalize(resourceType, 'ResourceType', root)
            })
        }

        await dispatch('useProjectState', {projectPath, root, shouldMerge})
        commit('loaded', true)


    },

    normalizeUnfurlData({getters, commit}, {key, entry, root, projectPath}) {
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

        // TODO refactor independent transformations into vue_shared/lib/normalize
        transforms = {
            ResourceType(resourceType) {
                localNormalize(resourceType, 'ResourceType', root)
            },
            ResourceTemplate(resourceTemplate) {
                resourceTemplate.dependencies = _.uniqBy(normalizeDependencies(resourceTemplate.dependencies), 'name')
                resourceTemplate.properties = _.uniqBy(normalizeProperties(resourceTemplate.properties), 'name')
                resourceTemplate._ancestors = lookupAncestors(resourceTemplate, root, true)

                resourceTemplate.properties.forEach(prop => {
                    if(Array.isArray(prop.value?.get_env)) {
                        prop.value.get_env = prop.value.get_env[0]
                    }
                })

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

                // aggressively add _sourceinfo if immediately available
                // this will not always be able to get _sourceinfo from types calls
                if(!resourceTemplate._sourceinfo) {
                    const type = getters.resolveResourceType(resourceTemplate.type)
                    if(type?._sourceinfo) {
                        resourceTemplate._sourceinfo = type._sourceinfo
                    }
                }

                localNormalize(resourceTemplate, 'ResourceTemplate', root)
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
                if(deploymentTemplate.source) {
                    if(!deploymentTemplate.ResourceTemplate) {
                        deploymentTemplate.ResourceTemplate = {}
                    }

                    Object.entries(getters.resolveDeploymentTemplate(deploymentTemplate.source)?.ResourceTemplate || {}).forEach(([name, rt]) => {
                        if(
                            (root.ResourceTemplate[name] && root.ResourceTemplate[name].directives.includes('default')) &&
                            (!deploymentTemplate.ResourceTemplate[name])
                        ) {
                            deploymentTemplate.ResourceTemplate[name] = rt
                        }
                    })
                }
                deploymentTemplate.__typename = 'DeploymentTemplate'
                localNormalize(deploymentTemplate, 'DeploymentTemplate', root)
            },
            ApplicationBlueprint(applicationBlueprint) {
                if(!applicationBlueprint.title) {
                    applicationBlueprint.title = applicationBlueprint.name
                }
                applicationBlueprint.__typename = 'ApplicationBlueprint'
            },
            Resource(resource, root) {
                if(!resource.dependencies) resource.dependencies = resource.connections || []
                if(!resource.attributes) resource.attributes = []
                if(!resource.visibility) resource.visibility = 'inherit'

                resource._ancestors = lookupAncestors(resource, root, true)

                resource.dependencies.forEach(dep => {
                    const visibility = dep.visibility || dep.constraint.visibility || 'visible'
                    dep.constraint.visibility = dep.visibility = visibility
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
                for(const connection of Object.values(de.connections || {})) {
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
                    commit('addRepositoryDependencies', [url.pathname.slice(1).replace(/\.git$/, '')], {root: true})
                }
            }
        }


        if(Object.isFrozen(entry)) return
        transforms[key] && transforms[key](entry, root)
    },

    async useProjectState({state, commit, dispatch}, {projectPath, root, shouldMerge}) {
        console?.assert(root && typeof root == 'object', 'Cannot use project state', root)
        if(!(state.clean || shouldMerge)) {
            commit('resetProjectState')
            commit('clearRepositoryDependencies', null, {root: true})
        }

        if(state.clean && projectPath) {
            commit('addRepositoryDependencies', [projectPath], {root: true})
        }

        const requiredSubstituteTypes = Object.values(root.ResourceTemplate || {}).filter(rt => rt.directives?.includes('substitute')).map(rt => root.ResourceType[rt.type])

        const cloud = Object.values(root.DeploymentTemplate || {}).length == 1 && Object.values(root.DeploymentTemplate)[0].cloud

        if(cloud) {
            await Promise.all(requiredSubstituteTypes.map(async (st) => {
                const exportParams = {...repoToExportParams(st._sourceinfo), file: st._sourceinfo?.file}

                const implementation_requirements = [cloud]
                const _extends = [st.name]
                const implementations = ['create']

                const fetchedTypes = (await unfurlServerGetTypes(exportParams, {implementations, implementation_requirements, 'extends': _extends})).ResourceType

                Object.values(fetchedTypes).filter(t => t.directives?.includes('substitute')).forEach(t => {console.log({t});root.ResourceType[t.name] = t})
            }))
        }

        // guarunteed ordering
        const ordering = uniq(['ResourceType', 'DefaultTemplate', 'DeploymentEnvironment', 'ResourceTemplate', 'DeploymentTemplate', 'Deployment'].concat(Object.keys(root)))

        for(const key of ordering) {
            const value = root[key]

            if(! value) continue

            Object.values(value).forEach(entry => {
                try {
                    dispatch('normalizeUnfurlData', {key, entry, root, projectPath})
                } catch(e) {
                    console.error({key, entry, root, projectPath})
                    console.error('@useProjectState', e)
                }
            })

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
    },

    async blueprintFetchTypesWithParams({state, getters, commit, dispatch}, {params}) {
        let types
        try {
            types = await fetchTypeRepositories(getters.blueprintRepositories, params)
        } catch(e) {
            const context = {
                repositories: getters.blueprintRepositories,
                params
            }

            try { Object.assign(context, e) }
            catch(e) {console.error(e)}

            commit('createError', {
                message: `@blueprintFetchTypesWithParams: failed to fetch types (${e.message})`,
                context,
                severity: 'major'
            }, {root: true})

            return
        }

        // prioritize types that are already defined when new type is incomplete
        Object.entries(state.ResourceType).forEach(([name, type]) => {
            const newType = types[name]

            if(newType && !newType._sourceinfo?.incomplete) {
                return
            }

            types[name] = type
        })

        await dispatch(
            'useProjectState',
            {root: {ResourceType: types}, shouldMerge: true}
        )
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
                if(typename == 'ResourceType') {
                    const qualifiedPrefix = `${name}@`
                    for(const key in dictionary) {
                        if(key.startsWith(qualifiedPrefix)) {
                            return dictionary[key]
                        }
                    }
                }
                return null
            }
        }
    }
}

const getters = {
    getApplicationRoot(state) {return state},
    resolveResourceType: storeResolver('ResourceType'),
    resolveResourceTypeWithAncestors(state, getters) {
        // where ancestors looks like [(ResourceType, RequirementConstraint?)]
        return function(resourceType, ancestors) {
            console.assert(resourceType, 'expected resource type')
            if(ancestors.length == 0)  {
                return getters.resolveResourceType(resourceType)
            }

            // don't mutate existing types
            const nodeFilterPath = _.cloneDeep([
                ...(ancestors.map(([rt, req]) => [getters.resolveResourceType(rt.type), req])),
                [getters.resolveResourceType(resourceType), null]
            ])


            for(let i = 0; i < ancestors.length; i++) {
                try {
                    const [current, req] = nodeFilterPath[i]
                    const [child, _] = nodeFilterPath[i+1]

                    const requirement = current.requirements.find(r => r.name == req)

                    if(requirement?.requirementsFilter) {
                        applyRequirementsFilter(child, requirement.requirementsFilter)
                    }

                    if(requirement?.inputsSchema) {
                        applyInputsSchema(child, requirement.inputsSchema)
                    }
                } catch(e) {
                    console.error('Could not apply requirements filter to requirement', e, {i, ancestors, resourceType, nodeFilterPath})
                }
            }

            const result = _.last(nodeFilterPath)[0]
            return result
        }
    },
    resolveResourceTemplateType(state, getters) {
        return function(resourceTemplate) {
            const rt = typeof resourceTemplate == 'string'? getters.resolveResourceTemplate(resourceTemplate): resourceTemplate
            return getters.resolveResourceType(rt.type)

            // too slow at the moment for the fact that it's not that useful
            // this is just for normalization

            // const ancestors = rt._ancestors || lookupAncestors(rt, state)
            // return getters.resolveResourceTypeWithAncestors(rt.type, ancestors)
        }
    },
    resolveResourceTemplate: storeResolver('ResourceTemplate'),
    resolveDeploymentTemplate: storeResolver('DeploymentTemplate'),
    resolveLocalResourceTemplate: storeResolver(
        function(state, deploymentTemplate, name) {
            try {
                return state.DeploymentTemplate[deploymentTemplate].ResourceTemplate[name]
            } catch(e) {return null}
        }
    ),
    localResourceTemplates(state) {
        return deploymentTemplate => {
            try {
                return Object.values(state.DeploymentTemplate[deploymentTemplate].ResourceTemplate)
            } catch(e) {
                return []
            }
        }
    },
    topLevelTemplates(state) {
        return Object.values(state.ResourceTemplate)
    },
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
            const generatedDependencies = getters.dependenciesFromResourceType(getters.resolveResourceTemplateType(resourceTemplate))
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
            const generatedProperties = getters.propertiesFromResourceType(getters.resolveResourceTemplateType(resourceTemplate))
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
            const type = getters.resolveResourceTemplateType(resourceTemplate)
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

    getPrimaryDeploymentBlueprint(state, getters) {
        return getters.getApplicationBlueprint?.primaryDeploymentBlueprint || (Object.values(state.DeploymentTemplate || {})[0])?.name
    },

    getResources(state) {return Object.values(state.Resource || {})},
    getDeployment(state) {return Object.values(state.Deployment || {})[0]},

    applicationBlueprintIsLoaded(state) {return state.loaded},

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

    blueprintResourceTypeDict(state) {
        return state.ResourceType
    },

    blueprintRepositories(state) {
        return Object.values(state.repositories)
    },
}


export default {state, mutations, actions, getters}
