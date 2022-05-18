import gql from 'graphql-tag'
import graphqlClient from '../../graphql';
import {uniq} from 'lodash'
import {lookupCloudProviderAlias} from '../../../vue_shared/util.mjs'
import {isConfigurable} from '../../../vue_shared/client_utils/resource_types'
import Vue from 'vue'


// TODO these classes are barely used and probably shouldn't stay
class ApplicationBlueprint {

    constructor(source, state) {
        for (const key in source) {
            this[key] = source[key]
        }

        this._state = state
    }


    getDeploymentTemplate(name) {
        const dt = this._state['DeploymentTemplate'][name]
        if(!dt) return null
        return new DeploymentTemplate(dt, this._state)
    }

    toJSON() {
        const result = {...this}
        delete result._state
        return result
    }
  
}

class DeploymentTemplate {

    constructor(source, state) {
        for (const key in source) {
            this[key] = source[key]
        }

        this._state = state
    }

    get _primary() {
        let primary
        try {
            primary = this._state['DeploymentTemplate'][this.name].ResourceTemplate[this.primary]
        } catch(e) {}

        if(!primary) primary = this._state['ResourceTemplate'][this.primary]

        if(primary) return new ResourceTemplate(primary, this._state)

        return null
    }

    toJSON() {
        const result = {...this}
        delete result._state
        return result
    }

}

class ResourceTemplate {
    
    constructor(source, state) {
        for(const key in source) {
            this[key] = source[key]
        }

        this._state = state

        /*
        for(const requirement of this._type.requirements) {
            if(!this.dependencies.find(dep => dep.constraint.name == requirement.name)) {

                this.dependencies.push({
                    __typename: 'Dependency',
                    name: requirement.name,
                    match: null,
                    target: null
                })
            }
        }
        */
    }

    get _type() {
        return this._state['ResourceType'][this.type]
    }

    toJSON() {
        const result = {...this}
        delete result._state
        return result
    }


}


const state = {loaded: false, callbacks: [], clean: true}
const mutations = {
    setProjectState(state, {key, value}) {
        Vue.set(state, key, value)
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
    async fetchProject({commit, dispatch}, params) {
        const {projectPath, fullPath, fetchPolicy, projectGlobal} = params
        commit('loaded', false)
        const query = gql`
          query GetDeploymentTemplateDictionaries($fullPath: ID!) {
              applicationBlueprintProject(fullPath: $fullPath, fetchPolicy: $fetchPolicy) @client {
                  ResourceType
                  ApplicationBlueprint
                  ResourceTemplate
                  DeploymentTemplate
              }
          }
        `

        const result = await graphqlClient.defaultClient.query({
            query,
            variables: {
                ...params,
                fullPath: projectPath || fullPath,
                dehydrated: true,
                fetchPolicy,
            },
            fetchPolicy

        })


        // normalize messy data in here
        const {data, errors} = result
        const root = data.applicationBlueprintProject
        root.projectGlobal = projectGlobal
        if(errors?.length) {
            for(const error of errors) {
                console.error(error)
                throw new Error('Could not fetch project blueprint')
            }
        }
        dispatch('useProjectState', {projectPath, root})


        commit('loaded', true)
    },
    useProjectState({state, commit, getters}, {projectPath, root, shouldMerge}) {
        console?.assert(root && typeof root == 'object', 'Cannot use project state', root)
        if(!(state.clean || shouldMerge)) {
            commit('resetProjectState')
        }
        let transforms
        transforms = {
            // This is for templates that are hidden from unfurl, but are necessary for drafts to function
            DefaultTemplate(defaultTemplate, root) {
                root.ResourceTemplate[defaultTemplate.name] = {...defaultTemplate}
                for(const key in defaultTemplate) {
                    delete defaultTemplate[key]
                }
            },
            ResourceTemplate(resourceTemplate) {
                resourceTemplate.dependencies = resourceTemplate.dependencies || []
                resourceTemplate.properties = resourceTemplate.properties || []

                for(const generatedDep of getters.getMissingDependencies(resourceTemplate)) {
                    resourceTemplate.dependencies.push(generatedDep)
                }
                for(const generatedProp of getters.getMissingProperties(resourceTemplate)) {
                    resourceTemplate.properties.push(generatedProp)
                }

                for(const prop of resourceTemplate.properties) {
                    if(prop.value == '<<REDACTED>>') prop.value = null
                }

                if(!resourceTemplate.visibility) resourceTemplate.visibility = 'inherit'
                resourceTemplate.dependencies.forEach(dep => {
                    if(!dep.constraint.visibility) dep.constraint.visibility = 'visible'
                })
                resourceTemplate.__typename = 'ResourceTemplate'
            },
            DeploymentTemplate(deploymentTemplate) {
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
                if(!applicationBlueprint.projectIcon) {
                    applicationBlueprint.projectIcon = root?.projectGlobal?.projectIcon
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
            }
        }

        // guarunteed ordering
        const ordering = uniq(['ResourceType', 'DefaultTemplate', 'ResourceTemplate', 'DeploymentTemplate', 'Deployment'].concat(Object.keys(root)))

        for(const key of ordering) {
            const value = root[key]
            if(typeof value != 'object') continue
            if(typeof transforms[key] == 'function')
                Object.values(value).forEach(entry => {if(typeof entry == 'object') {transforms[key](entry, root)}})
            commit('setProjectState', {key, value})
        }
        if(root.ApplicationBlueprint) {
            commit('setProjectState', {key: 'applicationBlueprint', value: Object.values(root.ApplicationBlueprint)[0]})
        }
    }
    
}

function storeResolver(typename, options) {
    const defaults = {}
    const {instantiateAs} = Object.assign(defaults, options)
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
                if(instantiateAs) {
                    result = new instantiateAs(entry, state)
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
    resolveResourceTemplate: storeResolver('ResourceTemplate', {instantiateAs: ResourceTemplate}),
    resolveDeploymentTemplate: storeResolver('DeploymentTemplate', {instantiateAs: DeploymentTemplate}),
    resolveLocalResourceTemplate: storeResolver(
        function(state, deploymentTemplate, name) {
            try {
                return state.DeploymentTemplate[deploymentTemplate].ResourceTemplate[name]
            } catch(e) {return null}
        },
        {instantiateAs: ResourceTemplate}
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
    getApplicationBlueprint(state) { return new ApplicationBlueprint(state.applicationBlueprint, state)},

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
    getValidResourceTypes(state, getters) {
        return function(dependency, _deploymentTemplate, environment) {
            // having trouble getting fetches finished before the ui starts rendering
            try {
                if(!dependency || !state.ResourceType) return []
                const dependencyName = typeof(dependency) == 'string'? dependency:
                    dependency.name
                //dependency.resourceType || dependency.constraint && dependency.constraint.resourceType.name

                function filteredByType(resourceType) {
                    let typeName = typeof(resourceType) == 'string'? resourceType: resourceType.name
                    return Object.values(state.ResourceType).filter(type => {
                        const isValidImplementation =  Array.isArray(type.extends) && type.extends.includes(typeName)
                        const isConcreteType = Array.isArray(type.implementations) && type.implementations.length > 0
                        return isValidImplementation && isConcreteType
                    })
                }
                let result = filteredByType(dependencyName)

                const deploymentTemplate = typeof _deploymentTemplate == 'string'?
                    getters.resolveDeploymentTemplate(_deploymentTemplate) :
                    new DeploymentTemplate(_deploymentTemplate, state)

                if(result.length == 0 && deploymentTemplate) {
                    const dependencies = deploymentTemplate._primary.dependencies
                    if(dependencies) {
                        const dependency = dependencies.find(dependency => dependency.name == dependencyName)
                        if(dependency) {
                            result = filteredByType(dependency.constraint.resourceType)
                        }
                    }
                }

                // providing an environment if this is a deployment
                if(environment) {
                    // TODO resolve the connection type to check extends
                    result = result.filter(type => {
                        if(Array.isArray(type.implementation_requirements) && type.implementation_requirements.length) {
                            return type.implementation_requirements.every(
                                req => environment.connections.some(conn => conn.type == req) 
                            )
                        }
                        return true
                    })
                }
                // old algorithm
                else {
                    // TODO query for this information
                    const CLOUD_MAPPINGS = {
                        [lookupCloudProviderAlias('gcp')]: 'unfurl.nodes.GoogleCloudObject', 
                        [lookupCloudProviderAlias('aws')]: 'unfurl.nodes.AWSResource',
                        [lookupCloudProviderAlias('azure')]: 'unfurl.nodes.AzureResources', 
                        //[lookupCloudProviderAlias('k8s')]: unknown
                    }

                    if(deploymentTemplate?.cloud) {
                        const allowedCloudVendor = lookupCloudProviderAlias(deploymentTemplate.cloud)
                        result = result.filter(type => {
                            return !type.extends.includes('unfurl.nodes.CloudObject') ||
                                type.extends.includes(CLOUD_MAPPINGS[allowedCloudVendor])
                        })
                    }
                }

                return result

            } catch(e) {
                console.error(e)
                return []
            }
        }
    }
}


export default {state, mutations, actions, getters}
