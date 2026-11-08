import {slugify, deepClone as cloneDeep} from 'oc_vue_shared/util'
import {environmentVariableDependencies, transformEnvironmentVariables} from 'oc_vue_shared/lib/deployment-template'
import {shareEnvironmentVariables} from 'oc_vue_shared/client_utils/environments'
import {fetchUserAccessToken} from 'oc_vue_shared/client_utils/user'
import {unfurlServerExport} from 'oc_vue_shared/client_utils/unfurl-server'
import {fetchLastCommit, getOrFetchCurrentBranch} from 'oc_vue_shared/client_utils/projects'
import {projectPathToHomeRoute} from 'oc_vue_shared/client_utils/dashboard'
import {localNormalize} from 'oc_vue_shared/lib/normalize'
import _ from 'lodash'
import axios from '~/lib/utils/axios_utils'
import type {ActionContext, Module} from '@gitlab/vuex-vue3'

// The unfurl export JSON; typed loosely until the payload types exist.
type Json = Record<string, any>

// One deployment's slice of the export: Deployment, DeploymentTemplate,
// Resource, ResourceTemplate, ResourceType..., keyed by name.
type DeploymentDict = Json & {_environment?: string}

type ShareState = 'environment' | 'dashboard' | null

// false from a hook cancels the deploy
type DeploymentHook = () => boolean | void | Promise<boolean | void>

interface State {
    deployments: DeploymentDict[]
    deploymentHooks: DeploymentHook[]
    // keyed `__${environment}__${deployment}__${resource}`
    shareStates: Record<string, ShareState>
}

type Context = ActionContext<State, any>

type Named = {name: string} | string | null | undefined
const nameOf = (x: Named) => (x as {name?: string})?.name || (x as string)

interface ResourceRef {
    environmentName: string
    deploymentName: string
    resourceName: string
}

const state = (): State => ({deployments: [], deploymentHooks: [], shareStates: {}});
const mutations = {
    setDeployments(state: State, deployments: DeploymentDict[]) {
        for(const deployment of deployments) {
            for(const key of Object.keys(deployment)) {
                for(const entry of Object.values(deployment[key] || {}) as unknown[]) {
                    if(typeof entry == 'string') continue
                    if(!entry) continue
                    try {
                        localNormalize(entry, key, deployment)
                    } catch(e) {
                        console.error((e as Error).message)
                    }
                }
            }
        }
        state.deployments = deployments;
    },

    onDeploy(state: State, cb: DeploymentHook) {
        state.deploymentHooks.push(cb)
        state.deploymentHooks = state.deploymentHooks
    },

    clearDeploymentHooks(state: State) {
        state.deploymentHooks = []
    },

    setShareState(state: State, {shareState, name}: {shareState: ShareState, name: string}) {
        state.shareStates[name] = shareState
    }
};
const actions = {
    async createDeploymentPathPointer({commit, dispatch, rootGetters}: Context, {projectPath, environment, deploymentDir, dryRun, environmentName}: {
        projectPath?: string
        environment?: Named
        environmentName?: string
        deploymentDir: string
        dryRun?: boolean
    }) {
        commit('setCommitMessage', `Record deployment path for ${deploymentDir}`)
        commit('setUpdateObjectProjectPath', projectPath || rootGetters.getHomeProjectPath)
        commit('setUpdateType', 'environment', {root: true})
        const _environmentName = environmentName || nameOf(environment)
        const mutation = () => [{
                typename: 'DeploymentPath',
                patch: {__typename: 'DeploymentPath', environment: _environmentName},
                target: deploymentDir
            }]

        commit('pushPreparedMutation', mutation, {root: true})
        await dispatch('runEnvironmentSaveHooks', null, {root: true})
        await dispatch('commitPreparedMutations', {dryRun}, {root: true})
    },

    async cloneDeployment({getters, dispatch, rootGetters, commit}: Context, args: {
        deployment: Named
        environment: Named
        newDeploymentTitle?: string
        targetEnvironment?: Named
        dryRun?: boolean
    }) {
        const {deployment, environment, newDeploymentTitle, targetEnvironment, dryRun} = args
        if(rootGetters.hasPreparedMutations) {
            commit('createError', {
                message: "Can't clone deployment - there are prepared changes that haven't been committed. This is a bug.",
                context: args,
                severity: 'critical'
            })
            return
        }
        const deploymentName = nameOf(deployment)
        const environmentName = nameOf(environment)
        const targetEnvironmentName = (nameOf(targetEnvironment) || environmentName)
        const sourceDeploymentDict = getters.getDeploymentDictionary(deploymentName, environmentName)
        const deployPathName = rootGetters.lookupDeployPath(deploymentName, environmentName)?.name

        function getPreviousDeploymentName(deployPathName: string) {
            return deployPathName.split('/').pop()!
        }

        function getNewDeploymentName(newDeploymentTitle: string | undefined, targetEnvironmentName: string) {
            let newDeploymentName =  newDeploymentTitle && slugify(newDeploymentTitle)
            if(!newDeploymentName || getters.lookupDeploymentOrDraft(newDeploymentName, targetEnvironmentName)) {
                newDeploymentName = `clone-${Date.now().toString(36)}`
            }

            return newDeploymentName
        }

        function renameDeploymentTemplate(dt: Json, name: string, title: string | undefined) {
            dt.title = title
            dt.name = name
            dt.slug = name
        }

        if(sourceDeploymentDict && deployPathName) {
            const {DeploymentTemplate, ResourceTemplate, ApplicationBlueprint} = sourceDeploymentDict
            const deploymentObj: Json = cloneDeep({DeploymentTemplate, ResourceTemplate, ApplicationBlueprint})
            const prevDeploymentName = getPreviousDeploymentName(deployPathName)
            const newDeploymentName = getNewDeploymentName(newDeploymentTitle, targetEnvironmentName)


            deploymentObj.DeploymentTemplate = { [newDeploymentName]: deploymentObj.DeploymentTemplate[prevDeploymentName] }
            renameDeploymentTemplate(deploymentObj.DeploymentTemplate[newDeploymentName], newDeploymentName, newDeploymentTitle)

            for(const template of Object.values(deploymentObj.ResourceTemplate) as Json[]) {
                const type = sourceDeploymentDict.ResourceType[template.type]
                if(template.directives?.includes('default')) {
                    delete deploymentObj.ResourceTemplate[template.name]
                    continue
                }
                if(type._sourceinfo) {
                    template._sourceinfo = type._sourceinfo // not bothering to clone here
                }
            }

            delete deploymentObj.DeploymentTemplate[newDeploymentName].ResourceTemplate

            const variables = environmentVariableDependencies(deploymentObj)
            // no prefix: the substitution alone renames
            const usePrefix = false
            const substitutions: [RegExp, string][] = [
                [new RegExp(`^${prevDeploymentName.replace(/-/g, '_')}__`), `${newDeploymentName.replace(/-/g, '_')}__`]
            ]
            const {transferredVariables} = await shareEnvironmentVariables(rootGetters.getHomeProjectPath, environmentName, targetEnvironmentName, variables, usePrefix, substitutions)
            transformEnvironmentVariables(deploymentObj, transferredVariables, usePrefix, substitutions)

            return await dispatch('commitClonedDeployment', {deploymentObj, deployPathName, newDeploymentName, environmentName, targetEnvironmentName, dryRun})

        }
    },

    async commitClonedDeployment({dispatch, commit, rootGetters}: Context, {deploymentObj, deployPathName, newDeploymentName, environmentName, targetEnvironmentName, dryRun}: {
        deploymentObj: Json
        deployPathName: string
        newDeploymentName: string
        environmentName: string
        targetEnvironmentName: string
        dryRun?: boolean
    }) {
        function getDeploymentDir(deployPathName: string, newDeploymentName: string) {
            const splits = deployPathName.split('/')
            splits[splits.indexOf(environmentName)] = targetEnvironmentName
            splits.pop()
            splits.push(newDeploymentName)
            return splits.join('/')
        }

        const deploymentDir = getDeploymentDir(deployPathName, newDeploymentName)

        //commit('useBaseState', {}, {root: true})
        commit('setCommitMessage', `Clone into ${newDeploymentName}`)
        commit('setUpdateObjectProjectPath', rootGetters.getHomeProjectPath, {root:true})
        commit('setUpdateObjectPath', deploymentDir, {root: true})
        commit('setUpdateType', 'deployment', {root: true})
        for(const [typename, dictionary] of Object.entries(deploymentObj)) {
            for(const [name, value] of Object.entries(dictionary as Json)) {
                commit(
                    'pushPreparedMutation',
                    () => [{typename, patch: value, target: name}],
                    {root: true}
                )
            }
        }
        await dispatch('commitPreparedMutations', {dryRun}, {root: true})

        if(rootGetters.hasCriticalErrors) return

        if(dryRun) {
            commit('clearPreparedMutations', null, {root:true})
        }
        await dispatch('createDeploymentPathPointer', {environment: targetEnvironmentName, deploymentDir, dryRun})
        return newDeploymentName
    },

    async updateProjectSubscription({rootGetters}: Context, {projectPath, op}: {projectPath: string, op: 'inc' | 'dec'}) {
        const dict = JSON.parse(rootGetters.lookupVariableByEnvironment('UNFURL_PROJECT_SUBSCRIPTIONS', '*') || '{}')
        const _projectPath = projectPath.toLowerCase()

        const items = dict.subscriptions[_projectPath]

        const url = `${projectPathToHomeRoute(rootGetters.getHomeProjectPath)}/-/subscriptions?upstream=${encodeURIComponent(projectPath)}`

        if(op == 'inc' && items?.length == 1) {
            await axios.post(url)
        } else if(op == 'dec' && items?.length == 0) {
            await axios.delete(url)
        }

    },

    async postQueuedProjectSubscriptions({rootGetters, dispatch}: Context) {
        const subscriptionsStore = rootGetters.lookupVariableByEnvironment('UNFURL_PROJECT_SUBSCRIPTIONS', '*')
        if(!subscriptionsStore) return
        const dict = JSON.parse(subscriptionsStore)
        const queued = dict?.queued
        if(!(dict && queued)) return
        if(!dict.subscriptions) dict.subscriptions = {}
        const subscriptions = dict.subscriptions

        const projectPathsNeedUpdate: string[] = []

        Object.entries(queued as Record<string, ResourceRef[]>).forEach(([projectPath, items]) => {
            let i = 0
            const _projectPath = projectPath.toLowerCase()
            if(!subscriptions[_projectPath]) subscriptions[_projectPath] = []
            for(const record of items) {
                const {resourceName, deploymentName, environmentName} = record

                if(environmentName != rootGetters.getCurrentEnvironment.name || deploymentName != rootGetters.getDeploymentTemplate.name) {
                    continue
                }

                const card = rootGetters.getCardsStacked.find((card: Json) => card.name == resourceName)
                if(!card) continue
                const hasCorrectProjectId = card.properties.some((prop: Json) => prop.name == 'project_id' && prop.value?.toLowerCase() == _projectPath)
                if(card && hasCorrectProjectId) {
                    subscriptions[_projectPath].push(record)
                    i++
                }
            }
            if(i > 0) {
                projectPathsNeedUpdate.push(_projectPath)
            }
        })

        delete dict.queued

        await dispatch(
            'setEnvironmentVariable',
            {
                environmentName: '*',
                variableName: 'UNFURL_PROJECT_SUBSCRIPTIONS',
                variableValue: JSON.stringify(dict)
            },
            {root: true}
        )

        for(const projectPath of projectPathsNeedUpdate) {
            await dispatch('updateProjectSubscription', {projectPath, op: 'inc'})
        }

    },

    async runDeploymentHooks({state, dispatch}: Context) {
        for(const hook of state.deploymentHooks) {
            let result = hook()
            if(typeof (result as Promise<unknown>)?.then == 'function') {
                result = await result
            }
            if(result === false) { return false }
        }
        try {
            await dispatch('postQueuedProjectSubscriptions')
        } catch(e) {
            // this is probably OK if the environment isn't loaded yet
            // for GCP a pipeline has to run to create the provider - this is started after the cluster creation redirect
            console.error('@runDeploymentHooks: failed to post subscriptions', e)
        }
        return true
    },

    unshareResourceFromEnvironment({commit, rootGetters}: Context, {environmentName, deploymentName, resourceName}: ResourceRef) {
        const name = `__${environmentName}__${deploymentName}__${resourceName}`
        commit(
            'pushPreparedMutation',
            () => {
                const environment = rootGetters.lookupEnvironment(environmentName)
                // TODO check if this needs to be cloned
                const patch = cloneDeep({...environment, instances: {...environment.instances, [name]: undefined}})
                return [{target: environmentName, patch, typename: 'DeploymentEnvironment'}];
            },
            {root: true}
        )
    },

    unshareResourceFromDefaults({commit, rootGetters}: Context, {environmentName, deploymentName, resourceName}: ResourceRef) {
        const name = `__${environmentName}__${deploymentName}__${resourceName}`
        commit(
            'pushPreparedMutation',
            () => {
                const environment = rootGetters.getEnvironmentDefaults
                // instances is initially an object for defaults
                const patch = cloneDeep({...environment, instances: {...environment.instances, [name]: undefined}})
                return [{target: 'defaults', patch, typename: 'DeploymentEnvironment'}];
            },
            {root: true}
        )
    },

    async unshareResource({getters, commit, dispatch, rootGetters}: Context, {environmentName, deploymentName, resourceName}: ResourceRef) {
        const currentShareState = getters.getResourceSharedState(environmentName, deploymentName, resourceName)
        if(!currentShareState) return

        commit('setShareState', {shareState: null, name: `__${environmentName}__${deploymentName}__${resourceName}` })

        //commit('useBaseState', {}, {root: true})
        commit('setCommitMessage', `Unshare ${resourceName}`, {root: true})
        commit('setUpdateType', 'environment', {root: true})
        commit('setUpdateObjectProjectPath', rootGetters.getHomeProjectPath, {root:true})


        if(currentShareState == 'environment') {
            dispatch('unshareResourceFromEnvironment', {environmentName, deploymentName, resourceName})
        } else if (currentShareState == 'dashboard') {
            dispatch('unshareResourceFromDefaults', {environmentName, deploymentName, resourceName})
        }

        await dispatch('commitPreparedMutations')
    },

    shareResourceIntoEnvironment({commit, rootGetters}: Context, {environmentName, deploymentName, resourceName}: ResourceRef) {
        // TODO not sure we want to couple with template_resources in here
        let resource = rootGetters.getCardsStacked.find((card: Json) => card.name == resourceName)

        if(!resource && resourceName == rootGetters.getPrimaryCard.name) {
            resource = rootGetters.getPrimaryCard
        }

        const type = rootGetters.resolveResourceTypeFromAny(resource.type)
        const newObject = {
            name: `__${environmentName}__${deploymentName}__${resourceName}`,
            metadata: {
                extends: type?.extends || [],
            },
            title: resource.title,
            directives: ['select'],
            imported: `${deploymentName}:${resource.name}`,
            type: resource.type,
            _sourceinfo: type?._sourceinfo,
            __typename: 'ResourceTemplate'
        }

        commit(
            'pushPreparedMutation',
            () => {
                // we can use acc here because updateResourceSharedState populated the state
                //const patch = acc.DeploymentEnvironment[environmentName]
                const patch = cloneDeep(rootGetters.lookupEnvironment(environmentName))
                patch.instances[newObject.name] = newObject
                return [{target: environmentName, patch, typename: 'DeploymentEnvironment'}];
            },
            {root: true}
        )
    },

    shareResourcesIntoDefaults({commit, rootGetters}: Context, {environmentName, deploymentName, resourceName}: ResourceRef) {
        const resource = rootGetters.getCardsStacked.find((card: Json) => card.name == resourceName)

        const name = `__${environmentName}__${deploymentName}__${resourceName}`
        const type = rootGetters.resolveResourceTypeFromAny(resource.type)
        const newObject = {
            name,
            metadata: {
                extends: type?.extends || [],
            },
            title: resource.title,
            directives: ['select'],
            imported: `${deploymentName}:${resource.name}`,
            type: resource.type,
            _sourceinfo: type?._sourceinfo,
            __typename: 'ResourceTemplate'
        }

        commit(
            'pushPreparedMutation',
            () => {
                const patch = cloneDeep(rootGetters.getEnvironmentDefaults)
                patch.instances[name] = newObject
                return [{target: 'defaults', patch, typename: 'DeploymentEnvironment'}];
            },
            {root: true}
        )
    },

    async updateResourceSharedState({getters, commit, dispatch, rootGetters}: Context, {environmentName, deploymentName, resourceName, shareState}: ResourceRef & {shareState: ShareState}) {

        const currentShareState = getters.getResourceSharedState(environmentName, deploymentName, resourceName)
        if(!shareState || shareState == currentShareState) return

        if(currentShareState) {
            await dispatch('unshareResource', {environmentName, deploymentName, resourceName})
        }

        commit('setShareState', {shareState, name: `__${environmentName}__${deploymentName}__${resourceName}` })

        //commit('useBaseState', {}, {root: true})
        commit('setCommitMessage', `Share ${resourceName} with ${shareState}`, {root: true})
        commit('setUpdateType', 'environment', {root: true})
        commit('setUpdateObjectProjectPath', rootGetters.getHomeProjectPath, {root:true})

        if(shareState == 'environment') {
            dispatch('shareResourceIntoEnvironment', {environmentName, deploymentName, resourceName})
        } else if (shareState == 'dashboard') {
            dispatch('shareResourcesIntoDefaults', {environmentName, deploymentName, resourceName})
        }

        await dispatch('commitPreparedMutations')
    },

    async renameDeployment({getters, commit, rootGetters, dispatch}: Context, {deploymentName, environmentName, newTitle}: {deploymentName: string, environmentName: string, newTitle: string}) {
        const deploymentDict = getters.getDeploymentDictionary(deploymentName, environmentName)

        const deployment = Object.values(deploymentDict.Deployment)[0] as Json, deploymentTemplate = Object.values(deploymentDict.DeploymentTemplate)[0] as Json
        const deploymentDir = rootGetters.lookupDeployPath(deploymentName, environmentName)?.name

        if(deployment.title == newTitle) return

        commit('setCommitMessage', `Rename ${deployment.title || deploymentName} to ${newTitle}`)
        commit('setUpdateObjectProjectPath', rootGetters.getHomeProjectPath)
        commit('setUpdateType', 'deployment', {root: true})
        commit('setUpdateObjectPath', deploymentDir, {root: true})

        const updateTitleInDeployment = () => [{
            typename: 'Deployment',
            patch: {__typename: 'Deployment', ...deployment, title: newTitle},
            target: deploymentName
        }]

        const updateTitleInDeploymentTemplate = () => [{
            typename: 'DeploymentTemplate',
            patch: {__typename: 'DeploymentTemplate', ...deploymentTemplate, title: newTitle},
            target: deploymentName
        }]

        commit('pushPreparedMutation', updateTitleInDeployment, {root: true})
        commit('pushPreparedMutation', updateTitleInDeploymentTemplate, {root: true})

        await dispatch('commitPreparedMutations')
    },

    async fetchDeployment({state, commit, rootGetters}: Context, {deploymentName, environmentName, projectPath, branch, setCurrentBranch}: {
        deploymentName: string
        environmentName: string
        projectPath: string
        branch?: string
        setCurrentBranch?: boolean
    }) {

        let deployment: Json | undefined
        branch = branch || await getOrFetchCurrentBranch(encodeURIComponent(projectPath))

        const format = 'deployment'
        const deploymentPath = rootGetters.lookupDeployPath(deploymentName, environmentName).name

        try {
            // Pre-fetch the branch HEAD so the export request carries a known-
            // fresh latest_commit. If a local deploy left the working tree
            // dirty, /branches returns `<sha>-dirty` and the rust proxy
            // bypasses its cache so we see the updated deployment status.
            deployment = await unfurlServerExport({
                format,
                projectPath,
                deploymentPath,
                branch,
                setCurrentBranch,
                lastCommitResult: fetchLastCommit(projectPath, branch), // awaited in unfurlServerExport
            })
        } catch(_e) {
            const e = _e as Error & {response?: {data?: unknown}}
            const responseData = e.response?.data
            commit('createError', {
                message: `Load deployment: An error occurred during an export request (${e.message})`,
                context: {
                    error: e.message,
                    format,
                    deploymentPath,
                    projectPath,
                    branch,
                    ...(typeof responseData == 'object'? responseData: null)
                },
                severity: 'critical'
            })
            return
        }


        if(!deployment) return

        if(deployment.error) {
            commit('createError', {
                message: `Load deployment: The server could not export ${deploymentPath} (${deployment.error})`,
                detail: `Error occured while exporting a deployment`,
                deployment: deployment.deployment,
                url: deployment.deployment.replace(/^(..\/)*/, window.location.origin + '/'),
                error: deployment.error
            })
        }

        try {
            const [, deploymentObject] = Object.entries(deployment.Deployment)[0]

            deployment._environment = environmentName

            if(deployment.ResourceType) {
                Object.values(deployment.ResourceType).forEach(rt => localNormalize(rt, 'ResourceType', deployment))
            }

            localNormalize(deploymentObject, 'Deployment', deployment)
        } catch(e) {
            // the shape that failed is the one being reported, so read it with care
            const title = (Object.values(deployment.Deployment || {})[0] as Json | undefined)?.title
            commit('createError', {
                message: `Load deployment: Unexpected shape for ${title || deploymentPath} (${(e as Error).message})`,
                deployment: title,
                detail: 'Unexpected shape for deployment',
                error: (e as Error).message,
            })
        }

        commit('setDeployments', [...state.deployments, deployment])
    }

};
const getters = {
    getDeploymentDictionary(state: State) {
        return function(deploymentName: string, environmentName: string): DeploymentDict | null {
            for(const dict of state.deployments) {
                const deployment = (
                    (dict.Deployment && dict.Deployment[deploymentName]) ||
                    (dict.DeploymentTemplate && dict.DeploymentTemplate[deploymentName])
                )
                if(deployment && dict._environment == environmentName) // _environment assigned on fetch in environments store
                    return dict
            }
            return null
        }
    },
    getDeploymentDictionaries(state: State) {
        return state.deployments
    },
    // TODO use getDeploymentsOrDrafts internally
    getDeployments(state: State) {
        if(!state.deployments) return []
        const result: Json[] = []
        for(const dict of state.deployments) {
            if(!_.isObject(dict.Deployment)) continue
            Object.values(dict.Deployment as Json).forEach(dep => {
                result.push({...dep, _environment: dict._environment}) // _environment assigned on fetch in environments store
            })
        }
        return result
    },
    getDeploymentsOrDrafts(state: State, _a: unknown, _b: unknown, rootGetters: any) {
        if(!state.deployments) return []
        const result: Json[] = []
        for(const dict of state.deployments) {
            const deployment = _.isObject(dict.Deployment) && dict.Resource[(Object.values(dict.Deployment)[0] as Json).primary]? dict.Deployment: dict.DeploymentTemplate
            if(!deployment) continue
            Object.values(deployment as Json).forEach(dep => {
                result.push({...dep, _environment: dict._environment}) // _environment assigned on fetch in environments store
            })
        }
        for(const dashboard of rootGetters.getAdditionalDashboards || []) {
            for(const dict of dashboard?.deployments || []) {
                const deployment = _.isObject(dict.Deployment)? dict.Deployment: dict.DeploymentTemplate
                if(!deployment) continue
                result.push(Object.values(deployment as Json)[0])
            }
        }
        return result

    },
    getDeploymentsByEnvironment(_: State, getters: any) {
        return function(environment?: string | null): Json[] {
            if(!environment) {
                return getters.getDeployments
            }
            return getters.getDeployments.filter((dep: Json) => dep._environment == environment)
        }
    },

    filteredPrimariesByEnvironment(_: State, getters: any) {
        return function(environmentName: string, filter: (primary: Json, related: {dictionary: Json, type: Json, deployment: Json, template: Json}) => boolean) {
            const result: Json[] = []
            getters.getDeploymentsByEnvironment(environmentName).forEach((deployment: Json) => {
                try {
                    const dictionary = getters.getDeploymentDictionary(deployment.name, environmentName)
                    const primary = dictionary.Resource[deployment.primary]
                    const template = dictionary.ResourceTemplate[primary.template]
                    const type = dictionary.ResourceType[template.type]

                    if(filter(primary, {dictionary, type, deployment, template})) {
                        result.push({...primary, _deployment: deployment.name, _type: type})
                    }
                } catch(e) {
                    console.error(`Could not get primary as connection for ${deployment.name}`, (e as Error).message)
                }
            })
            return result
        }
    },

    getResourceSharedState(state: State, _a: unknown, _b: unknown, rootGetters: any) {
        return function(environmentName: string, deploymentName: string, resourceName: string): ShareState {
            const name = `__${environmentName}__${deploymentName}__${resourceName}`
            if(state.shareStates.hasOwnProperty(name)) {
                return state.shareStates[name]
            }

            let environmentDefaults
            if(environmentDefaults = rootGetters.getEnvironmentDefaults) {
                // instances is not an array here
                try {
                    if(environmentDefaults.instances[name]) return 'dashboard'
                } catch(e) {}
            }
            if(rootGetters.lookupConnection(environmentName, name)) return 'environment'
            return null
        }
    },

    getNextDefaultDeploymentName: (_state: State, getters: any) => function(templateTitle: string, _environment?: string) {
        // the title is free text, so it has to be escaped to match itself
        const re = new RegExp(`${_.escapeRegExp(templateTitle)} (\\d+)`)
        let max = 1
        // use below if we want to count from one for each environment
        // for(const deployment of getters.getDeploymentsByEnvironment(environment)) {
        //
        // update - this used to use getDeployments but is now using getDeploymentsOrDrafts
        for(const deployment of getters.getDeploymentsOrDrafts) {
            const match = deployment.title.match(re)
            if(match) {
                const n = parseInt(match[1])
                if(n >= max) { max = n + 1 }
            }
        }

        return `${templateTitle} ${max}`
    },
    lookupDeploymentOrDraft(_: State, getters: any) {
        return function(deploymentName: string, environment: Named) {
            const _environment = nameOf(environment)
            const result = getters.getDeploymentsOrDrafts.find((dep: Json) => dep._environment == _environment && dep.name == deploymentName)
            return result
        }

    },
    lookupDeployment(_: State, getters: any) {
        return function(deploymentName: string, environment?: string) {
            const deployments = environment?
                getters.getDeploymentsByEnvironment(environment) :
                getters.getDeployments
            const result = deployments.find((dep: Json) => dep.title == deploymentName || dep.name == slugify(deploymentName))
            return result
        }
    },
    listSharedResources(_: State, getters: any) {
        return function(deploymentName: string, environmentName: string): Json[] {
            const dictionary = getters.getDeploymentDictionary(deploymentName, environmentName)
            return (Object.values(dictionary.Resource) as Json[])
                .filter(r => getters.getResourceSharedState(environmentName, deploymentName, r.name))
        }
    },
    getSharedResource(_: State, getters: any) {
        return function(deploymentName: string, environmentName: string, resourceName: string) {
            const dictionary = getters.getDeploymentDictionary(deploymentName, environmentName)
            return (Object.values(dictionary.Resource) as Json[])
                .find(r => r.name == resourceName)
        }
    },
    getSharedResourceTemplate(_: State, getters: any) {
        return function(deploymentName: string, environmentName: string, templateName: string) {
            const dictionary = getters.getDeploymentDictionary(deploymentName, environmentName)
            return (Object.values(dictionary.ResourceTemplate) as Json[])
                .find(r => r.name == templateName)
        }
    },

    deleteDeploymentPreventedBy(_: State, getters: any) {
        return function(deploymentName: string, environmentName: string) {
            const result: string[] = []
            getters.listSharedResources(deploymentName, environmentName).forEach(
                (r: Json) => result.push(`A shared resource <b>${r.title}</b> exists in this deployment.`)
            )

            return result
        }
    },

    undeployPreventedBy(_: State, getters: any) {
        return function(deploymentName: string, environmentName: string) {
            const result: string[] = []
            getters.listSharedResources(deploymentName, environmentName)
                .filter((r: Json) => !r.protected)
                .forEach(
                    (r: Json) =>  result.push(`An unprotected shared resource <b>${r.title}</b> exists in this deployment.`)
                )

            return result
        }
    },
    getEnvironmentForDeployment(state: State, _a: unknown, _b: unknown, rootGetters: any) {
        return function(deploymentName: string, preferEnvironment?: string) {
            const paths: {name: string, environment: string}[] = rootGetters.allDeploymentPaths
            let result
            if(preferEnvironment) {
                result = paths.find(p => p.name.endsWith(`/${deploymentName}`) && p.environment == preferEnvironment)
            }
            if(!result) {
                result = paths.find(p => p.name.endsWith(`/${deploymentName}`))
            }

            return result!.environment
        }
    }
};


export default {state, mutations, actions, getters} satisfies Module<State, any>;
