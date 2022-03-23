import { __ } from "~/locale";
import gql from 'graphql-tag'
import graphqlClient from '../../graphql';
import {cloneDeep} from 'lodash'
import { USER_HOME_PROJECT, lookupCloudProviderAlias } from '../../../vue_shared/util.mjs'
import {isDiscoverable} from '../../../vue_shared/client_utils/resource_types'
import createFlash, { FLASH_TYPES } from '~/flash';
import {prepareVariables, triggerPipeline} from '../../../vue_shared/client_utils/pipelines'


const state = {
    environmentName: __("Oc Default"),
    environments: [],
    projectEnvironments: [],
    resourceTypeDictionaries: {}
};

function connectionsToArray(environment) {
    if(Array.isArray(environment)) return environment
    if(environment.connections) {
        for(const key in environment.connections) { 
            if(isNaN(parseInt(key))) { //// not sure how much of this is still needed
                delete environment.connections[key]
            }
        }
        environment.connections = Object.values(environment.connections)
    }
    if(environment.instances) {
        for(const key in environment.instances) { 
            if(isNaN(parseInt(key))) { //// not sure how much of this is still needed
                delete environment.instances[key]
            }
        }
        environment.instances = Object.values(environment.instances)
    }

    return environment
}

const mutations = {

    SET_ENVIRONMENT_NAME(_state, { envName }) {
        // eslint-disable-next-line no-param-reassign
        _state.environmentName = envName;
    },

    setEnvironments(state, environments) {
        state.environments = environments
    },

    setDeploymentPaths(state, deploymentPaths) {
        state.deploymentPaths = deploymentPaths
    },

    patchEnvironment(state, { envName, patch }) {
        const env = state.projectEnvironments.find(env => env.name == envName)
        Object.assign(env, patch)
        state.environments = state.environments
    },

    environmentsToArray(state) {
        // map is kinda pointless here
        state.environments = state.environments.map(connectionsToArray)
        state.projectEnvironments = state.projectEnvironments.map(connectionsToArray)
    },

    setProjectEnvironments(state, environments) {
        state.projectEnvironments = environments
    },

    setResourceTypeDictionary(state, { environment, dict }) {
        state.resourceTypeDictionaries[environment.name] = dict
    }

};

const actions = {

    async deployInto({rootGetters, getters, commit, dispatch}, parameters) {
        const deployVariables = prepareVariables({
            ...parameters,
            mockDeploy: rootGetters.UNFURL_MOCK_DEPLOY,
            workflow: 'deploy'
        })
        const data = await triggerPipeline(
            rootGetters.pipelinesPath,
            deployVariables,
        )
        commit('setUpdateObjectPath', 'environments.json', {root: true})
        commit('setUpdateObjectProjectPath', rootGetters.getHomeProjectPath, {root: true})
        commit('pushPreparedMutation', () => {
            return [{
                typename: 'DeploymentPath',
                patch: {
                    __typename: 'DeploymentPath',
                    environment: parameters.environmentName,
                    pipeline: {
                        id: data.id,
                        flags: data.flags,
                        commit: data.commit,
                        variables: Object.values(deployVariables).reduce((acc, variable) => {acc[variable.key] = variable.secret_value; return acc}, {})
                    }
                },
                target: parameters.deployPath
            }]
        })
        await dispatch('commitPreparedMutations', {}, {root: true})
        return {pipelineData: data}
    },

    async deleteDeployment({rootGetters, getters, commit, dispatch}, {deploymentName, environmentName}) {
        const deployPath = rootGetters.lookupDeployPath(deploymentName, environmentName)
        commit('setUpdateObjectPath', 'environments.json', {root: true})
        commit('setUpdateObjectProjectPath', rootGetters.getHomeProjectPath, {root: true})
        commit('pushPreparedMutation', () => {
            return [{
                typename: 'DeploymentPath',
                patch: null,
                target: deployPath.name
            }]
        })
        await dispatch('commitPreparedMutations', {}, {root: true})
    },

    setEnvironmentName({ commit }, envName) {
        commit("SET_ENVIRONMENT_NAME", { envName });
    },

    async updateEnvironment({getters, commit, dispatch, rootGetters}, {env, envName, patch}) {
        const _envName =  envName || env?.name
        commit('patchEnvironment', {envName: _envName, patch})
        const _env = getters.lookupEnvironment(_envName)

        commit('setUpdateObjectPath', `environments.json`, {root: true})
        commit('setUpdateObjectProjectPath', rootGetters.getHomeProjectPath, {root: true})
        commit(
            'pushPreparedMutation', 
            _ => {
                // I thought awaiting commit prepared mutations would make it so I don't have to clone env
                // apparently not
                return [ {typename: 'DeploymentEnvironment', target: _env.name, patch: cloneDeep(_env)}]
            },
            {root: true}
        )
        await dispatch('commitPreparedMutations', null,  {root: true})
        commit('environmentsToArray')
    },


    async fetchProjectEnvironments({commit}, {fullPath}) {
        const query = gql`
        query getProjectEnvironments($fullPath: ID!) {
            project(fullPath: $fullPath) {
                environments {
                    nodes {
                        deploymentEnvironment @client {
                            connections
                            instances
                            primary_provider
                        }
                        ResourceType @client
                        deployments
                        clientPayload
                        name
                    }
                }
            }
        }`
        let environments
        let deployments = []
        try {
            const {data, errors} = await graphqlClient.clients.defaultClient.query({
                query,
                errorPolicy: 'all',
                variables: {fullPath}
            })
            if(errors) {throw new Error(errors)}

            // cloning in the resolver can't be relied on unless we use a different fetchPolicy
            // there's probably a better way of getting vuex to stop watching environments when we call this action
            // alternatively we could check if it's cached
            environments = cloneDeep(data.project.environments).nodes.map(environment => {
                Object.assign(environment, environment.deploymentEnvironment)
                const deploymentPaths = Object.values(environment.clientPayload.DeploymentPath || {})
                commit('setResourceTypeDictionary', {environment, dict: environment.ResourceType})
                commit('setDeploymentPaths', deploymentPaths)
                delete environment.ResourceType
                for(const deployment of environment.deployments) {
                    if(!deployment._environment) deployment._environment = environment.name
                    for(const dep of Object.values(deployment.Deployment || {})) {
                        dep.__typename = 'Deployment'
                    }
                    deployments.push(deployment)
                }
                delete environment.deploymentEnvironment
                delete environment.clientPayload
                environment.__typename = 'DeploymentEnvironment' // just documenting this to avoid confusion with __typename Environment
                connectionsToArray(environment)

                return environment
            })

        }
        catch(e){
            console.error('Could not fetch project environments', e)
            return createFlash({ message: 'Could not fetch project environments.  Is your environments.json valid?', type: FLASH_TYPES.ALERT });
            environments = []

        }
        commit('setDeployments', deployments, {root: true})
        commit('setProjectEnvironments', environments)

    },
    async ocFetchEnvironments({ commit, dispatch, rootGetters }, {fullPath, projectPath}) {
        // TODO get rid of this alias
        return await dispatch('fetchProjectEnvironments', {fullPath: fullPath || projectPath})
    }
};
function envFilter(name){
    return env => env.name == name
} 

const getters = {
    getEnvironmentName: _state => _state.environmentName,
    getEnvironments: state => state.projectEnvironments,
    lookupEnvironment: (_, getters) => function(name) {return getters.getEnvironments.find(envFilter(name))},
    getValidConnections: (state, _a, _b, rootGetters) => function(environmentName, requirement) {
        let constraintType
        if(typeof requirement != 'string') { constraintType = requirement?.constraint?.resourceType 
        } else { constraintType  = requirement }
        const filter = envFilter(environmentName)
        const environment = state.environments.find(filter) || state.projectEnvironments.find(filter)
        //if(!environment) {throw new Error(`Environment ${environmentName} not found`)}
        if(!environment) return []
        let result = []
        if(environment.instances) result = environment.instances.filter(conn => {
            const cextends = rootGetters.resolveResourceType(conn.type)?.extends
            return cextends && cextends.includes(constraintType)
        })
        return result
    },
    getMatchingEnvironments: (_, getters) => function(type) {

        if(!type) { return getters.getEnvironments }
        const result = getters.getEnvironments.filter(env => {
            if(env?.primary_provider) return lookupCloudProviderAlias(env.primary_provider.type) == lookupCloudProviderAlias(type)
            else return true
        })
        return result
    },
    getDefaultEnvironmentName: (_, getters) => function(type) {
        if(!type) return null
        return getters.getMatchingEnvironments(type).find(env => env.primary_provider && lookupCloudProviderAlias(env.primary_provider.type) == lookupCloudProviderAlias(type))?.name
    },
    lookupConnection: (_, getters) => function(environmentName, connectedResource) {
        const environment = getters.lookupEnvironment(environmentName)
        //if(!environment) {throw new Error(`Environment ${environmentName} not found`)}
        if(! Array.isArray(environment?.instances) ) return null
        return cloneDeep(environment.instances.find(conn => conn.name == connectedResource))
    },
    environmentResourceTypeDict(state) {
        return function(environment) {
            const environmentName = typeof environment == 'string'? environment: environment?.name
            return state.resourceTypeDictionaries[environmentName]
        }
    },
    environmentResolveResourceType(state) {
        return function(environment, typename) {
            const environmentName = typeof environment == 'string'? environment: environment?.name
            const dict = state.resourceTypeDictionaries[environmentName]
            if (dict) return dict[typename]
            return null
        }
    },
    environmentLookupDiscoverable(state, getters) {
        return function(_environment) {
            const environmentName = typeof _environment == 'string'? _environment: _environment?.name
            const dict = state.resourceTypeDictionaries[environmentName]
            if(typeof dict == 'object') {
                const environment = getters.lookupEnvironment(environmentName)
                const resolver = getters.environmentResolveResourceType.bind(null, environment)
                return Object.values(dict).filter(resourceType => isDiscoverable(resourceType, environment, resolver))
            }
            return null
        }
    },
    environmentHasActiveDeployments(state, getters, _, rootGetters) {
        return function(_environment) {
            const environmentName = typeof _environment == 'string'? _environment: _environment?.name
            const deployments = rootGetters.getDeploymentsByEnvironment(environmentName)
            return deployments.length > 0
        }
    },
    lookupDeployPath(state) {
        return function(deploymentName, environmentName) {
            const result = state.deploymentPaths.find(dp => dp.name.startsWith(`environments/${environmentName}`) && dp.name.endsWith(`/${deploymentName}`))
            return result
        }
    }
};

export default {
    state,
    mutations,
    actions,
    getters
};
