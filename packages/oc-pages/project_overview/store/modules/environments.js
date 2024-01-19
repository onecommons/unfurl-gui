import axios from '~/lib/utils/axios_utils'
import { __ } from "~/locale";
import _ from 'lodash'
import {cloneDeep} from 'lodash'
import {lookupCloudProviderAlias, slugify} from 'oc_vue_shared/util.js'
import {isDiscoverable} from 'oc_vue_shared/client_utils/resource_types'
import { FLASH_TYPES } from 'oc_vue_shared/client_utils/oc-flash';
import {prepareVariables, triggerAtomicDeployment} from 'oc_vue_shared/client_utils/pipelines'
import {toDepTokenEnvKey, patchEnv, fetchEnvironmentVariables} from 'oc_vue_shared/client_utils/envvars'
import {fetchProjectInfo, generateProjectAccessToken} from 'oc_vue_shared/client_utils/projects'
import {fetchEnvironments, shareEnvironmentVariables, fetchDashboardProviders} from 'oc_vue_shared/client_utils/environments'
import {tryResolveDirective} from 'oc_vue_shared/lib'
import {environmentVariableDependencies} from 'oc_vue_shared/lib/deployment-template'
import {constraintTypeFromRequirement} from 'oc_vue_shared/lib/resource-template'
import {deleteFiles} from 'oc_vue_shared/client_utils/commits'
import { fetchTypeRepositories, importsAreEqual } from  'oc_vue_shared/client_utils/unfurl-server'
import { localNormalize } from 'oc_vue_shared/lib/normalize'
import Vue from 'vue'


const state = () => ({
    projectEnvironments: [],
    resourceTypeDictionaries: {},
    variablesByEnvironment: {},
    saveEnvironmentHooks: [],
    additionalDashboardProviders: [],
    repositoryDeploymentDependencies: [],
    tempRepositories: [],
    defaults: null,
    projectPath: null,
    ready: false,
    upstreamCommit: null, upstreamProject: null, upstreamId: null,

    // leave always true while until the dispatch script is updated
    incrementalDeploymentEnabled: true,
});



const mutations = {
    setProjectPath(state, projectPath) {
        state.projectPath = projectPath
    },

    addRepositoryDependencies(state, dependencies) {
        state.repositoryDeploymentDependencies = state.repositoryDeploymentDependencies.concat(dependencies)
    },

    clearRepositoryDependencies(state) {
        state.repositoryDeploymentDependencies = []
    },

    onSaveEnvironment(state, cb) {
        state.saveEnvironmentHooks.push(cb)
        state.saveEnvironmentHooks = state.saveEnvironmentHooks
    },

    clearSaveEnvironmentHooks(state) {
        state.saveEnvironmentHooks = []
    },

    setDeploymentPaths(state, deploymentPaths) {
        deploymentPaths.forEach(
            dp => {
                if(Array.isArray(dp.pipelines)) {
                    // dp.pipeline = dp.pipelines[dp.pipelines.length - 1]
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
        state.upstreamProject = upstreamProject?.id || upstreamProject
    },

    setUpstreamBranch(state, upstreamBranch) {
        state.upstreamBranch = upstreamBranch
    },


    setAutostop(state, autostop) {
        state.autostop = autostop
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

    setProjectEnvironments(state, environments) {
        state.projectEnvironments = environments
    },

    setResourceTypeDictionary(state, { environment, dict }) {
        state.resourceTypeDictionaries[environment?.name || environment] = dict
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

    setAdditionalProviders(state, additionalDashboardProviders) {
        state.additionalDashboardProviders = additionalDashboardProviders
    },

    setDefaults(state, defaults) {
        state.defaults = defaults
    },

    addTempRepository(state, repo) {
        state.tempRepositories.push(repo)
    }

};

const actions = {

    async runEnvironmentSaveHooks({state}) {
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

        commit('setUpdateType', 'environment', {root: true})
        commit('setUpdateObjectProjectPath', rootGetters.getHomeProjectPath, {root: true})
        await dispatch('runEnvironmentSaveHooks') // putting this before pipeline so the upstream vars can be set

        // if upstreamProject is set as an ID, look up the upstream path
        const upstreamProjectPath = (
            !isNaN(parseInt(state.upstreamProject))?
                await fetchProjectInfo(state.upstreamProject):
                null
        )?.path_with_namespace

        if(upstreamProjectPath) {
            commit('addRepositoryDependencies', [upstreamProjectPath])
        }


        let deploymentDependencies = []
        let projectPath

        if(projectPath = rootGetters.getCurrentProjectPath) {
            deploymentDependencies = state.repositoryDeploymentDependencies
        } else {
            const deploymentDict = rootGetters.getDeploymentDictionary(
                parameters.deploymentName,
                parameters.environmentName
            )

            try {
                // result can contain null values; will filter out later
                projectPath = Object.values(deploymentDict.DeploymentTemplate)[0].projectPath
                deploymentDependencies = [
                    projectPath,
                    ...Object.values(deploymentDict.repositories).map(repo => {
                        try {
                            return (new URL(repo.url)).pathname.slice(1).replace(/\.git$/, '')
                        } catch(e) {}
                    })
                ]

                deploymentDependencies = _.uniq(deploymentDependencies)
            } catch(e) {
                console.error(
                    `Can't get deployment dependencies for ${JSON.stringify(parameters, null, 2)}`,
                    e,
                    'This is probably a GCP OAUTH flow environment'
                )
            }
        }

        const projects = await Promise.all(
            deploymentDependencies.map(
                dep => fetchProjectInfo(encodeURIComponent(dep))
                    .catch(e => {
                        commit(
                            'createError',
                            {message: `Couldn't lookup dependency info (${e.message})`, context: dep, severity: 'critical'},
                            {root: true}
                        )
                    })
            )
        )

        if(rootGetters.hasCriticalErrors) return

        const dashboardProjectId = (await fetchProjectInfo(encodeURIComponent(rootGetters.getHomeProjectPath))).id

        let writableBlueprintProjectUrl, blueprintToken
        const dependencies = deploymentDependencies
            .reduce((acc, v, i) => {
                // v left null instead of filtered out so we can zip here
                if(!v) return acc
                const project = projects[i]
                if(project.visibility == 'public') return acc
                const variableName = toDepTokenEnvKey(project.id)


                // TODO move this side effect out of a reduce
                if(v == projectPath && parameters.projectUrl) {
                    writableBlueprintProjectUrl = new URL(parameters.projectUrl)
                    writableBlueprintProjectUrl.username = `UNFURL_DEPLOY_TOKEN_${dashboardProjectId}`
                    writableBlueprintProjectUrl.password = '$' + variableName
                    writableBlueprintProjectUrl = writableBlueprintProjectUrl.toString()
                    blueprintToken = variableName
                }

                if(!getters.lookupVariableByEnvironment(variableName, '*')) {
                    acc[v] = variableName
                }

                return acc
            }, {})

        const deployVariables = await prepareVariables({
            ...parameters,
            writableBlueprintProjectUrl,
            blueprintToken,
            upstreamCommit: state.upstreamCommit?.id || state.upstreamCommit,
            upstreamBranch: state.upstreamBranch,
            upstreamProject: state.upstreamProject,
            upstreamProjectPath,
            mockDeploy: rootGetters.UNFURL_MOCK_DEPLOY,
        })


        let data

        try {
            data = await triggerAtomicDeployment(
                rootGetters.getHomeProjectPath,
                {
                    variables: deployVariables,
                    dependencies,
                    schedule: parameters.schedule || 'now',
                    ...parameters.deployOptions
                }
            )
        } catch(e) {
            commit(
                'createError',
                {
                    message: `Failed to trigger deployment (${e.message})`,
                    context: {
                        projectPath: rootGetters.getHomeProjectPath,
                        variables: deployVariables,
                        dependencies,
                        ...parameters.deployOptions
                    },
                    severity: 'critical'
                },
                {root: true}
            )
            return
        }

        const pipelines = [...(dp?.pipelines || [])]

        function dataToPipelineObj(data, deployVariables) {
            return data?
            {
                id: data.id,
                flags: data.flags,
                'commit_id': data.commit?.id || data.commit,
                variables: Object.values(deployVariables).filter(variable => !variable.masked).reduce((acc, variable) => {acc[variable.key] = variable.secret_value; return acc}, {}),
                'upstream_commit_id': state.upstreamCommit?.id || state.upstreamCommit,
                'upstream_pipeline_id': state.upstreamId,
                'upstream_project_id': state.upstreamProject?.id || state.upstreamProject,
                'upstream_project_path': state.upstreamProjectPath,
                'upstream_branch': state.upstreamBranch
            } :
            null
        }

        const pipeline = dataToPipelineObj(data, deployVariables)
        if(pipeline) {pipelines.push(pipeline)}

        if(state.autostop && parameters.workflow == 'deploy') {
            const {pipelineData, deployVariables} = (await dispatch(
                'undeployFrom',
                {
                    ...parameters,
                    schedule: `${state.autostop} seconds`,
                    skipCommit: true
                }
            ))

            const autostopPipeline = dataToPipelineObj(pipelineData, deployVariables)
            if(autostopPipeline) {
                pipelines.push(autostopPipeline)
            }
        }

        if(!parameters.skipCommit) {
            commit('setUpdateType', 'environment', {root: true})
            commit('setUpdateObjectProjectPath', state.projectPath, {root: true})
            const commitMessage = parameters.workflow == 'undeploy'?
                `Undeploy ${parameters.deploymentName} from ${parameters.environmentName}`:
                `Deploy ${parameters.deploymentName} into ${parameters.environmentName}`

            commit('setCommitMessage', commitMessage)

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
            commit('clearRepositoryDependencies', null)
        }

        return {pipelineData: data, deployVariables}
    },
    deployInto({dispatch}, parameters) {
        return dispatch('environmentTriggerPipeline', {...parameters, workflow: 'deploy'})
    },
    undeployFrom({dispatch}, parameters) {
        return dispatch('environmentTriggerPipeline', {...parameters, workflow: 'undeploy'})
    },
    async deleteDeployment({state, rootGetters, getters, commit, dispatch}, {deploymentName, environmentName}) {
        const deployPath = rootGetters.lookupDeployPath(deploymentName, environmentName)
        commit('useBaseState', {}, {root: true})
        commit('setUpdateType', 'delete-deployment', {root: true})
        commit('setUpdateObjectProjectPath', rootGetters.getHomeProjectPath, {root: true})

        const envvarsUpdate = {}
        Object.keys(state.variablesByEnvironment[environmentName]).forEach(envvar => {
            if(envvar.startsWith(`${deploymentName.replace(/-/g, '_')}__`)) {
                envvarsUpdate[envvar] = {_destroy: true}
            }
        })

        await patchEnv(envvarsUpdate, environmentName, rootGetters.getHomeProjectPath)

        commit('pushPreparedMutation', () => {
            return [{
                typename: 'DeploymentPath',
                patch: null,
                target: deployPath.name
            }]
        })
        await dispatch('commitPreparedMutations', {}, {root: true})

        // TODO remove after switch to delete_ensemble
        await deleteFiles(
            encodeURIComponent(rootGetters.getHomeProjectPath),
            [deployPath.name + '/ensemble.yaml'],
            {
                commitMessage: `Delete deployment records for ${deploymentName}`,
                accessToken: getters.lookupVariableByEnvironment('UNFURL_PROJECT_TOKEN', '*')
            }
        )
    },

    setEnvironmentName({ commit }, envName) {
        commit("SET_ENVIRONMENT_NAME", { envName });
    },

    async fetchProjectEnvironments({commit, dispatch, rootGetters}, options) {
        const {fullPath, branch, includeDeployments, only} = {includeDeployments: true, ...options}
        let environments = []
        try {
            const projectId = (await fetchProjectInfo(encodeURIComponent(fullPath)))?.id

            const result = await fetchEnvironments({
                fullPath,
                branch: branch || 'main',
                projectId,
                includeDeployments,
                only
            })

            result.errors.forEach(e => commit('createError', e, {root: true}))

            if(rootGetters.hasCriticalErrors) return

            environments = result.environments

            Object.values(result.ResourceType).forEach(type => localNormalize(type, 'ResourceType', {ResourceType: result.ResourceType}))
            // TODO figure out if we might need ResourceType dictionary per environment
            for(const environment of environments) {
                Object.values(environment.instances || {}).forEach(instance => localNormalize(instance, 'ResourceTemplate', {ResourceType: result.ResourceType}))
                Object.values(environment.connections || {}).forEach(connection => localNormalize(connection, 'ResourceTemplate', {ResourceType: result.ResourceType}))

                if(environment.primary_provider) {
                    localNormalize(environment.primary_provider, 'ResourceTemplate', {ResourceType: result.ResourceType})
                }

                commit('setResourceTypeDictionary', {environment, dict: result.ResourceType})
            }

            commit('setDefaults', result.defaults)
            commit('setDeploymentPaths', result.deploymentPaths)

            if(includeDeployments) {
                commit('setDeployments', result.deployments)
            }
        }
        catch(e){
            console.error(e)
            if(window.gon.current_username) {
                commit('createError', {
                    message: `Could not fetch project environments (${e})`,
                    context: e,
                    severity: 'critical',
                    issue: 'Missing environment',
                })
            }
            environments = []

        }
        commit('setProjectEnvironments', environments)
    },
    async fetchEnvironmentVariables({commit, rootGetters}, {fullPath}) {
        let envvars = []
        try {
            envvars = await fetchEnvironmentVariables(fullPath)
        } catch(e) {
            throw new Error(`Failed to fetch environment variables for ${fullPath}`, e.message)
        }

        const variablesByEnvironment = {'*': {}}
        for(const variable of envvars) {
            if(!variable.environment_scope) continue
            const varsForEnv = variablesByEnvironment[variable.environment_scope] || {}
            varsForEnv[variable.key] = variable.value
            variablesByEnvironment[variable.environment_scope] = varsForEnv
        }

        try {
            const namespaceDNS = rootGetters.getCurrentNamespace.split('/').reverse().join('.')?.toLowerCase()
            variablesByEnvironment['*']['PROJECT_DNS_ZONE'] = namespaceDNS + '.u.opencloudservices.net'
            commit('setVariablesByEnvironment', variablesByEnvironment)
        } catch(e) {
            throw new Error('Unable to set PROJECT_DNS_ZONE', e)
        }
    },
    async generateVaultPasswordIfNeeded({getters, dispatch, rootGetters}, {fullPath}) {
        const promises = []
        if(!getters.lookupVariableByEnvironment('UNFURL_VAULT_DEFAULT_PASSWORD', '*')) {
            const UNFURL_VAULT_DEFAULT_PASSWORD = tryResolveDirective({_generate: {preset: 'password'}})
            promises.push(
                dispatch('setEnvironmentVariable', {environmentName: '*', variableName: 'UNFURL_VAULT_DEFAULT_PASSWORD', variableValue: UNFURL_VAULT_DEFAULT_PASSWORD, masked: true})
                .catch(e => console.warn(`Failed to set vault password for ${fullPath}`, e.message))
            )
        }

        // issues with reactivity if this isn't set
        if(!getters.lookupVariableByEnvironment('UNFURL_PROJECT_SUBSCRIPTIONS', '*')) {
            promises.push(
                dispatch('setEnvironmentVariable', {environmentName: '*', variableName: 'UNFURL_PROJECT_SUBSCRIPTIONS', variableValue: "{}", masked: false})
            )
        }

        await Promise.all(promises)
    },
    async createAccessTokenIfNeeded({getters, dispatch}, {fullPath}) {
        const projectInfo = await fetchProjectInfo(encodeURIComponent(fullPath))
        const namespace = projectInfo?.namespace

        if(!namespace) return

        try {
            if(!getters.lookupVariableByEnvironment('UNFURL_PROJECT_TOKEN', '*')) {
                const scopes = ['api', 'read_api', 'read_registry', 'write_registry', 'read_repository', 'write_repository']
                const UNFURL_PROJECT_TOKEN = await generateProjectAccessToken(encodeURIComponent(fullPath), {name: 'UNFURL_PROJECT_TOKEN', scopes})

                if(! UNFURL_PROJECT_TOKEN) return
                await dispatch('setEnvironmentVariable', {environmentName: '*', variableName: 'UNFURL_PROJECT_TOKEN', variableValue: UNFURL_PROJECT_TOKEN, masked: true})
            }
        } catch(e) {
            console.warn('Unable to create access token')
        }
    },

    async ocFetchEnvironments({ commit, dispatch, rootGetters }, options) {
        const {fullPath, projectPath, branch, includeDeployments, only} = {
            includeDeployments: true,
            ...options
        }

        const _projectPath = fullPath || projectPath || rootGetters.getHomeProjectPath
        commit('setProjectPath', _projectPath)
        await Promise.all([
            (async () => {
                try {
                    await dispatch('fetchEnvironmentVariables', {fullPath: _projectPath})
                    await Promise.all([
                        dispatch('generateVaultPasswordIfNeeded', {fullPath: _projectPath}),
                        dispatch('createAccessTokenIfNeeded', {fullPath: _projectPath})
                    ])
                } catch(e) {
                    console.warn('@ocFetchProjectEnvironments: Could not read/write envvars', e)
                }
            })(),
            dispatch('fetchProjectEnvironments', {fullPath: _projectPath, branch, includeDeployments, only})
        ])

        commit('setReady', true)
    },

    async environmentFromProvider({state, commit, dispatch}, {provider, newEnvironmentName}) {
        /* If the provider is a connection, we'll copy all of the instances and the environment variables associated with:
         *   (1) the connection (2) each instance.
         *
         * If the provider is an instance, we'll copy only the instance and assume there are no dependencies.
         * In this case we'll copy only environment variables associated with the instance itself.
        */
        const cloneTarget = slugify(newEnvironmentName)
        const variables = []
        let instances = []
        const primary_provider = _.cloneDeep(provider.template)
        environmentVariableDependencies(primary_provider).forEach(v => variables.push(v))
        if(provider.source == 'connection') {
            instances = _.cloneDeep(provider.environment.instances)
            for(const instance of instances) {
                environmentVariableDependencies(instance).forEach(v => variables.push(v))
            }
        }
        await shareEnvironmentVariables(state.projectPath, provider.environment.name, cloneTarget, variables, '')

        commit('setUpdateType', 'environment', {root: true})
        commit('setUpdateObjectProjectPath', state.projectPath, {root: true})
        commit('pushPreparedMutation', () => {
            return [{
                typename: 'DeploymentEnvironment',
                patch: {
                    __typename: 'DeploymentEnvironment',
                    instances,
                    connections: {
                        primary_provider
                    }
                },
                target: cloneTarget
            }]
        })
        await dispatch('commitPreparedMutations', {}, {root: true})
    },

    async setEnvironmentVariable({commit, rootGetters}, {environmentName, variableName, variableValue, masked}) {
        commit('setVariableByEnvironment', {environmentName, variableName, variableValue})
        await patchEnv({[variableName]: {value: variableValue, masked: !!masked}}, environmentName, rootGetters.getHomeProjectPath)
    },

    async loadAdditionalProviders({rootGetters, commit}, {accessLevel=30}) {
        // include developer access for deploy requests, etc.
        const dashboards = (await axios.get(`/api/v4/dashboards?min_access_level=${accessLevel}`))?.data
            ?.filter(dashboard => dashboard.path_with_namespace != rootGetters.getHomeProjectPath)
            ?.map(dashboard => fetchDashboardProviders(dashboard.path_with_namespace)) || []

        const dashboardProviders = (await Promise.all(dashboards)).filter(provider => !!provider)

        commit('setAdditionalProviders', dashboardProviders)
    },

    // optional deployment name
    async environmentFetchTypesWithParams({getters, commit, state}, {environmentName, deploymentName, params}) {
        const currentEnvironmentRepositories = getters.currentEnvironmentRepositories(
            environmentName,
            deploymentName
        )

        let types

        try {
            types = await fetchTypeRepositories(
                currentEnvironmentRepositories,
                params
            )
        } catch(e) {
            console.error(e)
            const context = {
                currentEnvironmentRepositories,
                params,
            }

            try { Object.assign(context, e) }
            catch(e) {console.error(e)}

            commit('createError', {
                message: `@environmentFetchTypesWithParams: failed to fetch types (${e.message})`,
                context,
                severity: 'major'
            }, {root: true})

            return
        }

        const currentTypes = state.resourceTypeDictionaries[environmentName]

        Object.entries(types).forEach(([name, type]) => {
            try {
                if(!type._sourceinfo) {
                    throw new Error(`${name} has no sourceinfo`)
                }

                if(currentTypes[name] && type._sourceinfo.incomplete) {
                    delete types[name]
                }
            } catch(e) {
                if(!name.startsWith('__primary@')) { // reduntant error?
                    console.warn(`Can't read repository url from source info: ${e.message}`)
                }
            }
        })

        Object.values(types).forEach(type => localNormalize(type, 'ResourceType', {ResourceType: state.resourceTypeDictionaries[environmentName]}))

        commit(
            'setResourceTypeDictionary',
            // prioritize types that are already defined
            {environment: environmentName, dict: {...currentTypes, ...types}}
        )
    }

};
function envFilter(name){
    return env => env.name == name
}

const getters = {
    getEnvironments: state => state.projectEnvironments,
    lookupEnvironment: (_, getters) => function(name) {return getters.getEnvironments.find(envFilter(name))},
    getValidEnvironmentConnections: (state, getters, _, rootGetters) => function(environmentName, requirement, _resolver) {
        const resolver = _resolver? _resolver: getters.environmentResolveResourceType.bind(getters, environmentName)
        const filter = envFilter(environmentName)
        const environment = state.projectEnvironments.find(filter)
        const constraintType = constraintTypeFromRequirement(requirement)
        const availableTypes = rootGetters.availableResourceTypesForRequirement(requirement) // types that would be available to create
        if(!environment) return []
        let result = []
        if(environment.instances) result = Object.values(environment.instances).filter(conn => {
            const connExtends = [
                ...(resolver(conn.type)?.extends || []),
                ...(conn.metadata?.extends || []),
                // allow types declaring deprecates to substitute for any type they deprecate
                ...(resolver(conn.type)?.metadata?.deprecates || [])
                    .map(deprecated => resolver(deprecated)?.extends || [])
                    .flat()
            ]

            return (
                // is our create type in extends or would a deprecating type be valid to connect
                connExtends?.includes(constraintType) ||
                availableTypes.some(type => type.metadata.deprecates?.includes(conn.type))
            )
        })

        /*
         * primaries by default
        rootGetters.filteredPrimariesByEnvironment(environmentName, (primary, {type}) => type?.extends?.includes(constraintType))
            .forEach(primary => {
                const name = `__${primary._deployment}`
                const title = rootGetters.lookupDeployment(primary._deployment, environmentName)?.title || name
                result.push({...primary, name, title})
            })
        */

        return result
    },

    // TODO merge these implementations
    getMatchingEnvironments: (_, getters) => function(type) {
        // uncomment to make local dev agnostic
        //if(!type) { return getters.getEnvironments }
        const result = getters.getEnvironments.filter(env => {
            const connections = Array.isArray(env.connections)? env.connections: Object.values(env.connections)

            if(connections.length == 0 && !type) {
                return true
            }

            for(const connection of connections) {
                if(lookupCloudProviderAlias(connection?.type) == lookupCloudProviderAlias(type)) { return true }
            }

            return false
        })
        return result
    },

    getDefaultEnvironmentName: (_, getters) => function(type) {
        if(!type) return null
        return getters.getMatchingEnvironments(type).find(env => env.primary_provider && lookupCloudProviderAlias(env.primary_provider.type) == lookupCloudProviderAlias(type))?.name
    },

    lookupConnection: (_, getters) => function(environmentName, connectedResource) {
        const environment = getters.lookupEnvironment(environmentName)
        try {
            return cloneDeep(environment.instances[connectedResource])
        } catch(e) {
            return null
        }
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
            let result
            if (dict) result = Object.freeze(dict[typename?.name || typename])

            if(dict && !result) {
                const qualifiedPrefix = `${typename?.name || typename}@`
                for(const key in dict) {
                    if(key.startsWith(qualifiedPrefix)) {
                        result = dict[key]
                    }
                }
            }

            return result || null
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
            const prefix = `environments/${environmentName}`
            const suffix = `/${deploymentName}`
            return state.deploymentPaths.find(dp => dp.name?.startsWith(prefix) && dp.name?.endsWith(suffix))
        }
    },
    // do not use if the pipeline may have not been started yet
    lookupLastRecordedPipeline(state, getters) {
        return function(deploymentName, environmentName) {
            const deployPath = getters.lookupDeployPath(deploymentName, environmentName)
            return _.last(deployPath?.pipelines)
        }
    },
    hasDeployPathKey(state) {
        return function(key) {
            return state.deploymentPaths.some(dp => dp.name == key)
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
            const key = toDepTokenEnvKey(projectId)
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
            for(const connection of Object.values(environment.connections)) {
                if(isValidProvider(environment, connection)) {
                    result.push({environment, template: connection, source: 'connection'})
                }
            }
            for(const instance of Object.values(environment.instances)) {
                if(isValidProvider(environment, instance)) {
                    result.push({environment, template: instance, source: 'instance'})
                }
            }
        }
        return result
    },
    userCanEdit(_, getters) {
        // we can't read or set UNFURL_VAULT_DEFAULT_PASSWORD if we're not a maintainer
        // NOTE this criteria is meaningless when we're editing a blueprint
        return !!getters.lookupVariableByEnvironment('UNFURL_VAULT_DEFAULT_PASSWORD', '*')
    },

    getEnvironmentDefaults(state) { return state.defaults || null },

    getVariables(state) {
        return function(environment) {
            const environmentName = environment?.name || environment

            return {...state.variablesByEnvironment['*'], ...state.variablesByEnvironment[environmentName]}
        }
    },

    environmentTypeRepositories(state, getters) {
        return function(environment) {
            const environmentName = environment?.name || environment
            {
                const environment = getters.lookupEnvironment(environmentName)

                if(!environment) {
                    throw new Error(`Environment not found ${environmentName}`)
                }

                // call types on unique repositories
                return Object.values(environment.repositories || {})
            }
        }
    },

    providerTypesForEnvironment(state, getters) {
        return function(environment) {
            const environmentName = environment?.name || environment
            {
                const environment = getters.lookupEnvironment(environmentName)
                return _.uniq(Object.values(environment.connections).map(conn => conn.type))
            }
        }
    },

    additionalDashboardProviders(state) { return state.additionalDashboardProviders },

    currentEnvironmentRepositories(state, getters, _, rootGetters) {
        return function(environmentName, deploymentName) {
            let repos = getters.environmentTypeRepositories(environmentName)
            if(deploymentName) {
                const deployPath = getters.lookupDeployPath(deploymentName, environmentName)
                repos = [{
                    url: `${window.location.origin}/${rootGetters.getHomeProjectPath}.git`,
                    file: `${deployPath.name}/ensemble.yaml`
                }]
            }
            return [
                ...repos,
                ...state.tempRepositories
            ]

        }
    },

    allDeploymentPaths(state) {
        return Object.freeze(state.deploymentPaths)
    }
};

export default {
    state,
    mutations,
    actions,
    getters
};
