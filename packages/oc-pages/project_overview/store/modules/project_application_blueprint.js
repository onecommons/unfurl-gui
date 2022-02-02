import gql from 'graphql-tag'
import graphqlClient from '../../graphql';


class ApplicationBlueprint {

    constructor(source, state) {
        for (const key in source) {
            this[key] = source[key]
        }

        this._state = state
    }


    getDeploymentTemplate(name) {
        return new DeploymentTemplate(this._state['DeploymentTemplate'][name], this._state)
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
        return this._state['ResourceTemplate'][this.primary]
    }

}


const state = {loaded: false, callbacks: []}
const mutations = {
    setProjectState(state, {key, value}) {
        state[key] = value
    },
    loaded(state, status) {
        state.loaded = status
        state.callbacks.forEach(cb => {if(typeof cb == 'function') {cb()} else throw new Error('application blueprint callback is not a function')})  

        state.callbacks = []
    },
    onApplicationBlueprintLoaded(state, cb) { if(state.loaded) {cb()} else state.callbacks.push(cb) }

}
const actions = {
    async fetchProject({commit}, params) {
        const {projectPath, fullPath, fetchPolicy} = params
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
        const {data, errors} = result
        const root = data.applicationBlueprintProject

        for(const key in root) {
            commit('setProjectState', {key, value: root[key]})
        }
        if(root.ApplicationBlueprint) {
            commit('setProjectState', {key: 'applicationBlueprint', value: Object.values(root.ApplicationBlueprint)[0]})
        }

        commit('loaded', true)
    }
}
const getters = {
    resolveResourceType(state) { return name =>  state['ResourceType'][name] },
    resolveResourceTemplate(state) { return name =>  state['ResourceTemplate'][name] },
    resolveDeploymentTemplate(state) { return name =>  new DeploymentTemplate(state['DeploymentTemplate'][name], state) },
    resolveResource(state) { return name =>  state['Resource'][name] },
    resolveDeployment(state) { return name =>  state['Deployment'][name] },
    getApplicationBlueprint(state) { return new ApplicationBlueprint(state.applicationBlueprint, state)},
    applicationBlueprintIsLoaded(state) {return state.loaded},
    getValidResourceTypes(state, getters) {
        return function(dependency, _deploymentTemplate) {
            if(!dependency) return []
            const dependencyName = typeof(dependency) == 'string'? dependency:
                dependency.name
                //dependency.resourceType || dependency.constraint && dependency.constraint.resourceType.name

            function filteredByType(resourceType) {
                let typeName = typeof(resourceType) == 'string'? resourceType: resourceType.name
                return Object.values(state.ResourceType).filter(type => {
                    return Array.isArray(type.implements) && type.implements.includes(typeName)
                })
            }
            let result = filteredByType(dependencyName)


            const deploymentTemplate = getters.resolveDeploymentTemplate(
                typeof(_deploymentTemplate) == 'string'? 
                _deploymentTemplate: _deploymentTemplate.slug
            )


            if(result.length == 0 && deploymentTemplate) {
                const dependency = deploymentTemplate._primary.dependencies
                    .find(dependency => dependency.name == dependencyName)
                if(dependency) {
                    result = filteredByType(dependency.constraint.resourceType)
                }
            }
            
            // TODO query for this information
            const CLOUD_MAPPINGS = {
                'unfurl.nodes.AzureAccount': 'unfurl.nodes.AzureResources',
                'unfurl.nodes.GoogleCloudAccount': 'unfurl.nodes.GoogleCloudObject',
                'unfurl.nodes.AWSAccount': 'unfurl.nodes.AWSResource',
            }

            if(deploymentTemplate?.cloud) {
                const allowedCloudVendor = `unfurl.nodes.${deploymentTemplate.cloud}`
                result = result.filter(type => {
                    return !type.implements.includes('unfurl.nodes.CloudObject') ||
                        type.implements.includes(CLOUD_MAPPINGS[allowedCloudVendor])

                })
            }
            
            return result
        }
    }
}


export default {state, mutations, actions, getters}
