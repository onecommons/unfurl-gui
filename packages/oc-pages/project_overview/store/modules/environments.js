import axios from '~/lib/utils/axios_utils'
import { __ } from "~/locale";
import _ from 'lodash'
import gql from 'graphql-tag'
import graphqlClient from '../../graphql';
import {cloneDeep} from 'lodash'
import { USER_HOME_PROJECT, lookupCloudProviderAlias } from 'oc_vue_shared/util.mjs'
import {isDiscoverable} from 'oc_vue_shared/client_utils/resource_types'
import createFlash, { FLASH_TYPES } from 'oc_vue_shared/client_utils/oc-flash';
import {prepareVariables, triggerPipeline} from 'oc_vue_shared/client_utils/pipelines'
import {patchEnv, fetchEnvironmentVariables} from 'oc_vue_shared/client_utils/envvars'
import {generateAccessToken} from 'oc_vue_shared/client_utils/user'
import {generateGroupAccessToken} from 'oc_vue_shared/client_utils/group'
import {fetchProjectInfo, generateProjectAccessToken} from 'oc_vue_shared/client_utils/projects'
import {fetchEnvironments, connectionsToArray, shareEnvironmentVariables} from 'oc_vue_shared/client_utils/environments'
import {tryResolveDirective} from 'oc_vue_shared/lib'
import {prefixEnvironmentVariables, environmentVariableDependencies} from 'oc_vue_shared/lib/deployment-template'
import Vue from 'vue'


const state = () => ({
    environments: [],
    projectEnvironments: [],
    resourceTypeDictionaries: {},
    variablesByEnvironment: {},
    saveEnvironmentHooks: [],
    additionalDashboards: [],
    defaults: null,
    projectPath: null,
    ready: false,
    upstreamCommit: null, upstreamProject: null, upstreamId: null,

    // leave always true while until the dispatch script is updated
    incrementalDeploymentEnabled: true,
});



function toProjectTokenEnvKey(projectId) {
    return `_project_token__${projectId}`
}

const mutations = {
    setProjectPath(state, projectPath) {
        state.projectPath = projectPath
    },

    onSaveEnvironment(state, cb) {
        state.saveEnvironmentHooks.push(cb)
        state.saveEnvironmentHooks = state.saveEnvironmentHooks
    },

    clearSaveEnvironmentHooks(state) {
        state.saveEnvironmentHooks = []
    },

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

    setUpstreamBranch(state, upstreamBranch) {
        state.upstreamBranch = upstreamBranch
    },

    setIncrementalDeployment(state, incrementalDeploymentEnabled) {
        //state.incrementalDeploymentEnabled = incrementalDeploymentEnabled
    },

    clearUpstream(state) {
        state.upstreamCommit = null
        state.upstreamProject = null
        state.upstreamBranch = null
        state.upstreamId = null
        //state.incrementalDeploymentEnabled = false
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
    },

    setVariableByEnvironment(state, {environmentName, variableName, variableValue}) {
        const variables = state.variablesByEnvironment[environmentName] || {}
        variables[variableName] = variableValue
        Vue.set(state.variablesByEnvironment, environmentName, variables)
    },

    setAdditionalDashboards(state, additionalDashboards) {
        state.additionalDashboards = additionalDashboards
    },

    setDefaults(state, defaults) {
        state.defaults = defaults
    }

};

const actions = {

    async runEnvironmentSaveHooks({state, commit}) {
        const promises = []
        for(const hook of state.saveEnvironmentHooks) {
            let result = hook()
            if(typeof result?.then == 'function') {
                result = await result
            }
            if(result === false) { return false }
        }
        return true
    },

    async environmentTriggerPipeline({rootGetters, state, getters, commit, dispatch}, parameters) {
        if(! await dispatch('runDeploymentHooks', null, {root: true})) {return false}
        const dp = getters.lookupDeployPath(parameters.deploymentName, parameters.environmentName)

        commit('setUpdateObjectPath', 'environments.json', {root: true})
        commit('setUpdateObjectProjectPath', rootGetters.getHomeProjectPath, {root: true})
        await dispatch('runEnvironmentSaveHooks') // putting this before pipeline so the upstream vars can be set

        const deployVariables = await prepareVariables({
            ...parameters,
            upstreamCommit: state.upstreamCommit?.id || state.upstreamCommit,
            upstreamBranch: state.upstreamBranch,
            upstreamProject: state.upstreamProject,
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
                'commit_id': data.commit?.id || data.commit,
                variables: Object.values(deployVariables).filter(variable => !variable.masked).reduce((acc, variable) => {acc[variable.key] = variable.secret_value; return acc}, {}),
                'upstream_commit_id': state.upstreamCommit?.id || state.upstreamCommit,
                'upstream_pipeline_id': state.upstreamId,
                'upstream_project_id': state.upstreamProject?.id || state.upstreamProject,
                'upstream_branch': state.upstreamBranch
            } :
            null


        if(pipeline) {pipelines.push(pipeline)}

        commit('setUpdateObjectPath', 'environments.json', {root: true})
        commit('setUpdateObjectProjectPath', state.projectPath, {root: true})
        commit('pushPreparedMutation', () => {
            return [{
                typename: 'DeploymentPath',
                patch: {
                    __typename: 'DeploymentPath',
                    environment: parameters.environmentName,
                    'project_id': data?.project?.id,
                    pipelines,
                    'incremental_deploy': state.incrementalDeploymentEnabled ?? false,
                },
                target: parameters.deployPath
            }]
        })

        await dispatch('commitPreparedMutations', {}, {root: true})
        commit('clearUpstream')
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
        let environments, deployments = []
        try {
            const result = await fetchEnvironments({fullPath, fetchPolicy})
            environments = result.environments
            deployments = result.deployments
            for(const environment of environments) {
                commit('setResourceTypeDictionary', {environment, dict: environment.ResourceType})
                delete environment.ResourceType
            }
            commit('setDefaults', result.defaults)
            commit('setDeploymentPaths', result.deploymentPaths)
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
    async fetchEnvironmentVariables({commit, rootGetters}, {fullPath}) {
        let envvars = []
        try {
            envvars = await fetchEnvironmentVariables(fullPath)
        } catch(e) {
            console.warn(`Failed to fetch environment variables for ${fullPath}`, e.message)
        }

        const variablesByEnvironment = {'*': {}}
        for(const variable of envvars) {
            if(!variable.environment_scope) continue
            const varsForEnv = variablesByEnvironment[variable.environment_scope] || {}
            varsForEnv[variable.key] = variable.value
            variablesByEnvironment[variable.environment_scope] = varsForEnv
        }
        variablesByEnvironment['*']['PROJECT_DNS_ZONE'] = rootGetters.getCurrentNamespace + '.u.opencloudservices.net'
        commit('setVariablesByEnvironment', variablesByEnvironment)
    },
    async generateVaultPasswordIfNeeded({getters, dispatch, rootGetters}, {fullPath}) {
        const patchObj = {}
        if(!getters.lookupVariableByEnvironment('UNFURL_VAULT_DEFAULT_PASSWORD', '*')) {
            const UNFURL_VAULT_DEFAULT_PASSWORD = tryResolveDirective({_generate: {preset: 'password'}})
            patchObj['UNFURL_VAULT_DEFAULT_PASSWORD'] = {value: UNFURL_VAULT_DEFAULT_PASSWORD, masked: true} 
        }

        // issues with reactivity if this isn't set
        if(!getters.lookupVariableByEnvironment('UNFURL_PROJECT_SUBSCRIPTIONS', '*')) {
            patchObj['UNFURL_PROJECT_SUBSCRIPTIONS'] = {value: "{}", masked: false} 
        }

        if(Object.keys(patchObj).length > 0) {
            try {
                await patchEnv(patchObj, '*', fullPath)
                await dispatch('fetchEnvironmentVariables', {fullPath}) // mostly only useful for testing
            } catch(e) {
                console.warn(`Failed to set vault password for ${fullPath}`, e.message)
            }
        }

    },
    async createAccessTokenIfNeeded({getters, dispatch}, {fullPath}) {
        const projectInfo = await fetchProjectInfo(encodeURIComponent(fullPath)) 
        const namespace = projectInfo?.namespace

        if(!namespace) return
        if(!getters.lookupVariableByEnvironment('UNFURL_ACCESS_TOKEN', '*')) {
            let UNFURL_ACCESS_TOKEN

            if(namespace.kind == 'group') {
                UNFURL_ACCESS_TOKEN = await generateGroupAccessToken('UNFURL_ACCESS_TOKEN', namespace.full_path)
            } else {
                UNFURL_ACCESS_TOKEN = await generateAccessToken('UNFURL_ACCESS_TOKEN')
            }

            if(!UNFURL_ACCESS_TOKEN) return

            await patchEnv({UNFURL_ACCESS_TOKEN: {value: UNFURL_ACCESS_TOKEN, masked: true}}, '*', fullPath)
        }
    },
    async ocFetchEnvironments({ commit, dispatch, rootGetters }, {fullPath, projectPath, fetchPolicy}) {
        const _projectPath = fullPath || projectPath || rootGetters.getHomeProjectPath
        commit('setProjectPath', _projectPath)
        await Promise.all([
            dispatch('fetchProjectEnvironments', {fullPath: _projectPath, fetchPolicy}),
            dispatch('fetchEnvironmentVariables', {fullPath: _projectPath})
        ])
        dispatch('generateVaultPasswordIfNeeded', {fullPath: _projectPath}).then(() => commit('setReady', true))
        dispatch('createAccessTokenIfNeeded', {fullPath: _projectPath})
    },
    async generateProjectTokenIfNeeded({getters, rootGetters}, {projectId}) {
        const key = toProjectTokenEnvKey(projectId)
        let token
        if(!(token = getters.lookupProjectToken(projectId))) {
            const token = await generateProjectAccessToken(projectId)
            await patchEnv({ [key]: token }, '*', rootGetters.getHomeProjectPath)
        }
        return {key, token}
    },

    async environmentFromProvider({state, commit, dispatch}, {provider, newEnvironmentName}) {
        /* If the provider is a connection, we'll copy all of the instances and the environment variables associated with:
         *   (1) the connection (2) each instance.
         *
         * If the provider is an instance, we'll copy only the instance and assume there are no dependencies.
         * In this case we'll copy only environment variables associated with the instance itself.
        */
        const variables = []
        let instances = []
        const primary_provider = _.cloneDeep(provider.template)
        environmentVariableDependencies(provider.template).forEach(v => variables.push(v))
        if(provider.source == 'connection') {
            instances = _.cloneDeep(provider.environment.instances)
            for(const instance of instances) {
                environmentVariableDependencies(instance).forEach(v => variables.push(v))
            }
        }
        await shareEnvironmentVariables(state.projectPath, provider.environment.name, newEnvironmentName, variables, '')

        commit('setUpdateObjectPath', 'environments.json', {root: true})
        commit('setUpdateObjectProjectPath', state.projectPath, {root: true})
        commit('pushPreparedMutation', () => {
            return [{
                typename: 'DeploymentEnvironment',
                patch: {
                    __typename: 'DeploymentEnvironment',
                    instances,
                    connections: {
                        primary_provider: provider.template
                    }
                },
                target: newEnvironmentName
            }]
        })
        await dispatch('commitPreparedMutations', {}, {root: true})
    },

    async setEnvironmentVariable({commit, rootGetters}, {environmentName, variableName, variableValue, masked}) {
        commit('setVariableByEnvironment', {environmentName, variableName, variableValue})
        await patchEnv({[variableName]: {value: variableValue, masked: !!masked}}, '*', rootGetters.getHomeProjectPath)
    },

    async loadAdditionalDashboards({rootGetters, commit}) {
        const dashboards = (await axios.get(`/api/v4/dashboards?min_access_level=40`))?.data
            ?.filter(dashboard => dashboard.path_with_namespace != rootGetters.getHomeProjectPath)
            ?.map(dashboard => fetchEnvironments({fullPath: dashboard.path_with_namespace}))

        commit('setAdditionalDashboards', await Promise.all(dashboards))
    }

};
function envFilter(name){
    return env => env.name == name
} 

const getters = {
    getEnvironments: state => state.projectEnvironments
        .concat(Object.values(state.additionalDashboards.map(db => db.environments)))
        .flat(),
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
        rootGetters.filteredPrimariesByEnvironment(environmentName, (primary, {type}) => type?.extends?.includes(constraintType))
            .forEach(primary => {
                const name = `__${primary._deployment}`
                const title = rootGetters.lookupDeployment(primary._deployment, environmentName)?.title || name
                result.push({...primary, name, title})
            })

        return result
    },

    // TODO merge these implementations
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
    getAdditionalMatchingEnvironments(state, getters) {
        return function(type) {
            const result = state.additionalDashboards.map(dashboard => {
                const result = []
                const {environments} = dashboard
                for(const environment of environments) {
                    if(lookupCloudProviderAlias(environment.primary_provider?.type) == lookupCloudProviderAlias(type)) {
                        result.push(environment)
                    }
                }
                return result
            }).flat()

            return result
        }
    },
    //

    getDefaultEnvironmentName: (_, getters) => function(type) {
        if(!type) return null
        return getters.getMatchingEnvironments(type).find(env => env.primary_provider && lookupCloudProviderAlias(env.primary_provider.type) == lookupCloudProviderAlias(type))?.name
    },
    
    getAdditionalDashboards(state) {
        return state.additionalDashboards
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
    },
    availableProviders(_, getters) {
        const result = []
        function isValidProvider(environment, template) {
            const type = getters.environmentResolveResourceType(environment, template.type) 
            if(!Array.isArray(type?.extends)) return false
            return type.extends.includes('unfurl.relationships.ConnectsTo.CloudAccount') || type.extends.includes('unfurl.relationships.ConnectsTo.K8sCluster')
        }
        for(const environment of getters.getEnvironments) {
            for(const connection of environment.connections) {
                if(isValidProvider(environment, connection)) {
                    result.push({environment, template: connection, source: 'connection'})
                }
            }
            for(const instance of environment.instances) {
                if(isValidProvider(environment, instance)) {
                    result.push({environment, template: instance, source: 'instance'})
                }
            }
        }
        return result
    },
    userCanEdit(_, getters) {
        // we can't read or set UNFURL_VAULT_DEFAULT_PASSWORD if we're not a maintainer
        return !!getters.lookupVariableByEnvironment('UNFURL_VAULT_DEFAULT_PASSWORD', '*')
    },

    getEnvironmentDefaults(state) { return state.defaults || null }
};

export default {
    state,
    mutations,
    actions,
    getters
};
