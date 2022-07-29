import { __ } from "~/locale";
import gql from 'graphql-tag'
import graphqlClient from '../../graphql';
import {cloneDeep} from 'lodash'
import { USER_HOME_PROJECT, lookupCloudProviderAlias } from 'oc_vue_shared/util.mjs'
import {isDiscoverable} from 'oc_vue_shared/client_utils/resource_types'
import createFlash, { FLASH_TYPES } from 'oc_vue_shared/client_utils/oc-flash';
import {prepareVariables, triggerPipeline} from 'oc_vue_shared/client_utils/pipelines'
import {patchEnv, fetchEnvironmentVariables} from 'oc_vue_shared/client_utils/envvars'
import {generateAccessToken} from 'oc_vue_shared/client_utils/user'
import {generateProjectAccessToken} from 'oc_vue_shared/client_utils/projects'
import {tryResolveDirective} from 'oc_vue_shared/lib'


const state = {
    environments: [],
    projectEnvironments: [],
    resourceTypeDictionaries: {},
    variablesByEnvironment: {},
    projectPath: null,
    ready: false
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

function toProjectTokenEnvKey(projectId) {
    return `_project_token__${projectId}`
}

const mutations = {

    setEnvironments(state, environments) {
        state.environments = environments
    },

    setDeploymentPaths(state, deploymentPaths) {
        deploymentPaths.forEach(
            dp => {
                if(Array.isArray(dp.pipelines)) {
                    dp.pipeline = dp.pipelines[dp.pipelines.length - 1]
                }
            }
        )
        state.deploymentPaths = deploymentPaths
    },

    setUpstreamCommit(state, upstreamCommit) {
        state.upstreamCommit = upstreamCommit
    },

    setUpstreamId(state, upstreamId) {
        state.upstreamId = upstreamId
    },

    setUpstreamProject(state, upstreamProject) {
        state.upstreamProject = upstreamProject
    },

    clearUpstream(state) {
        state.upstreamCommit = null
        state.upstreamProject = null
        state.upstreamId = null
    },

    setReady(state, readyStatus) {
        state.ready = readyStatus
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
    },

    // TODO maybe add something that will delete the environment, that can also keep the state of the application consistent
    discardEnvironment(state, environmentName) {
        state.projectEnvironments = state.projectEnvironments.filter(env => env.name != environmentName)
    },

    setVariablesByEnvironment(state, variablesByEnvironment) {
        state.variablesByEnvironment = variablesByEnvironment
    }

};

const actions = {

    async environmentTriggerPipeline({rootGetters, state, getters, commit, dispatch}, parameters) {
        if(! await dispatch('runDeploymentHooks', null, {root: true})) {return false}
        const dp = getters.lookupDeployPath(parameters.deploymentName, parameters.environmentName)
        const deployVariables = await prepareVariables({
            ...parameters,
            mockDeploy: rootGetters.UNFURL_MOCK_DEPLOY,
        })
        let data, error
        data = await triggerPipeline(
            rootGetters.pipelinesPath,
            deployVariables,
        )
        if(error = data?.errors) {
            return {pipelineData: data, error}

        }
        const pipelines = [...(dp?.pipelines || [])]

        const pipeline = data?
            {
                id: data.id,
                flags: data.flags,
                commit: data.commit,
                variables: Object.values(deployVariables).filter(variable => !variable.masked).reduce((acc, variable) => {acc[variable.key] = variable.secret_value; return acc}, {}),
                upstreamCommit: state.upstreamCommit,
                upstreamId: state.upstreamId,
                upstreamProject: state.upstreamProject
            } :
            null

        commit('clearUpstream')

        if(pipeline) {pipelines.push(pipeline)}

        commit('setUpdateObjectPath', 'environments.json', {root: true})
        commit('setUpdateObjectProjectPath', rootGetters.getHomeProjectPath, {root: true})
        commit('pushPreparedMutation', () => {
            return [{
                typename: 'DeploymentPath',
                patch: {
                    __typename: 'DeploymentPath',
                    environment: parameters.environmentName,
                    projectId: data?.project?.id,
                    pipelines
                },
                target: parameters.deployPath
            }]
        })
        await dispatch('commitPreparedMutations', {}, {root: true})
        return {pipelineData: data}
    },
    deployInto({dispatch}, parameters) {
        return dispatch('environmentTriggerPipeline', {...parameters, workflow: 'deploy'})
    },
    undeployFrom({dispatch}, parameters) {
        return dispatch('environmentTriggerPipeline', {...parameters, workflow: 'undeploy'})
    },
    async deleteDeployment({rootGetters, getters, commit, dispatch}, {deploymentName, environmentName}) {
        const deployPath = rootGetters.lookupDeployPath(deploymentName, environmentName)
        commit('useBaseState', {}, {root: true})
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
        await dispatch('fetchProjectEnvironments', {fullPath: rootGetters.getHomeProjectPath, fetchPolicy: 'network-only'})
    },


    async fetchProjectEnvironments({commit}, {fullPath, fetchPolicy}) {
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
                        state
                    }
                }
            }
        }`
        let environments
        let deployments = []
        try {
            const {data, errors} = await graphqlClient.clients.defaultClient.query({
                query,
                fetchPolicy,
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
            if(window.gon.current_username) {
                createFlash({ projectPath: fullPath, message: 'Could not fetch project environments.  Is your environments.json valid?', type: FLASH_TYPES.ALERT, issue: 'Missing environment'});
            }
            environments = []

        }
        commit('setDeployments', deployments, {root: true})
        commit('setProjectEnvironments', environments)
    },
    async fetchEnvironmentVariables({commit}, {fullPath}) {
        const envvars = await fetchEnvironmentVariables(fullPath)
        const variablesByEnvironment = {}
        for(const variable of envvars || []) {
            if(!variable.environment_scope) continue
            const varsForEnv = variablesByEnvironment[variable.environment_scope] || {}
            varsForEnv[variable.key] = variable.value
            variablesByEnvironment[variable.environment_scope] = varsForEnv
        }
        commit('setVariablesByEnvironment', variablesByEnvironment)
    },
    async generateVaultPasswordIfNeeded({getters, dispatch}, {fullPath}) {
        if(!getters.lookupVariableByEnvironment('UNFURL_VAULT_DEFAULT_PASSWORD', '*')) {
            const UNFURL_VAULT_DEFAULT_PASSWORD = tryResolveDirective({_generate: {preset: 'password'}})
            await patchEnv({UNFURL_VAULT_DEFAULT_PASSWORD: {value: UNFURL_VAULT_DEFAULT_PASSWORD, masked: true}})
            await dispatch('fetchEnvironmentVariables', {fullPath}) // mostly only useful for testing
        }
    },
    async createAccessTokenIfNeeded({getters, dispatch}) {
        if(!getters.lookupVariableByEnvironment('UNFURL_ACCESS_TOKEN', '*')) {
            const UNFURL_ACCESS_TOKEN = await generateAccessToken('UNFURL_ACCESS_TOKEN')
            await patchEnv({UNFURL_ACCESS_TOKEN: {value: UNFURL_ACCESS_TOKEN, masked: true}}) // can't currently be masked due to mask limitations
        }
    },
    async ocFetchEnvironments({ commit, dispatch, rootGetters }, {fullPath, projectPath, fetchPolicy}) {
        await Promise.all([
            dispatch('fetchProjectEnvironments', {fullPath: fullPath || projectPath, fetchPolicy}),
            dispatch('fetchEnvironmentVariables', {fullPath: fullPath || projectPath})
        ])
        dispatch('generateVaultPasswordIfNeeded', {fullPath: fullPath || projectPath}).then(() => commit('setReady', true))
        dispatch('createAccessTokenIfNeeded')
    },
    async generateProjectTokenIfNeeded({getters, rootGetters}, {projectId}) {
        const key = toProjectTokenEnvKey(projectId)
        let token
        if(!(token = getters.lookupProjectToken(projectId))) {
            const token = await generateProjectAccessToken(projectId)
            await patchEnv({ [key]: token }, '*', rootGetters.getHomeProjectPath)
        }
        return {key, token}
    }

};
function envFilter(name){
    return env => env.name == name
} 

const getters = {
    getEnvironments: state => Object.freeze(state.projectEnvironments),
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
        // uncomment to make local dev agnostic
        //if(!type) { return getters.getEnvironments }
        const result = getters.getEnvironments.filter(env => {
            //if(env?.primary_provider) 
            return lookupCloudProviderAlias(env.primary_provider?.type) == lookupCloudProviderAlias(type)
            //else return false
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
            if (dict) return Object.freeze(dict[typename])
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
    // TODO rename to lookupDeployPathByEnvironment?
    lookupDeployPath(state) {
        return function(deploymentName, environmentName) {
            const result = state.deploymentPaths.find(dp => dp.name?.startsWith(`environments/${environmentName}`) && dp.name?.endsWith(`/${deploymentName}`))
            return result
        }
    },
    lookupVariableByEnvironment(state) {
        return function(variable, environmentName) {
            const name = environmentName?.name || environmentName
            try {
                return state.variablesByEnvironment[name][variable]
            } catch(e) {}
            return null
        }
    },
    lookupProjectToken(state, getters) {
        return function(projectId) {
            const key = toProjectTokenEnvKey(projectId)
            return getters.lookupVariableByEnvironment(key, '*')
        }
    },
    environmentsAreReady(state) {
        return state.ready
    }
};

export default {
    state,
    mutations,
    actions,
    getters
};
