import {slugify} from 'oc_vue_shared/util'
import {environmentVariableDependencies, transformEnvironmentVariables} from 'oc_vue_shared/lib/deployment-template'
import {shareEnvironmentVariables} from 'oc_vue_shared/client_utils/environments'
import {fetchUserAccessToken} from 'oc_vue_shared/client_utils/user'
import {unfurlServerExport} from 'oc_vue_shared/client_utils/unfurl-server'
import {localNormalize} from 'oc_vue_shared/lib/normalize'
import Vue from 'vue'
import _ from 'lodash'
import axios from '~/lib/utils/axios_utils'

const state = () => ({deployments: [], deploymentHooks: [], shareStates: {}});
const mutations = {
    setDeployments(state, deployments) {
        for(const deployment of deployments) {
            for(const key of Object.keys(deployment)) {
                for(const entry of Object.values(deployment[key] || {})) {
                    if(typeof entry == 'string') continue
                    if(!entry) continue
                    try {
                        localNormalize(entry, key, deployment)
                    } catch(e) {
                        console.error(e.message)
                    }
                }
            }
        }
        state.deployments = deployments;
    },

    onDeploy(state, cb) {
        state.deploymentHooks.push(cb)
        state.deploymentHooks = state.deploymentHooks
    },

    clearDeploymentHooks(state) {
        state.deploymentHooks = []
    },

    setShareState(state, {shareState, name}) {
        Vue.set(state.shareStates, name, shareState)
    }
};
const actions = {
    async createDeploymentPathPointer({commit, dispatch, rootGetters}, {projectPath, environment, deploymentDir, dryRun, environmentName}) {
        commit('setCommitMessage', `Record deployment path for ${deploymentDir}`)
        commit('setUpdateObjectProjectPath', projectPath || rootGetters.getHomeProjectPath)
        commit('setUpdateType', 'environment', {root: true})
        const _environmentName = environmentName || environment?.name || environment
        const mutation = () => [{
                typename: 'DeploymentPath',
                patch: {__typename: 'DeploymentPath', environment: _environmentName},
                target: deploymentDir
            }]

        commit('pushPreparedMutation', mutation, {root: true})
        await dispatch('runEnvironmentSaveHooks', null, {root: true})
        await dispatch('commitPreparedMutations', {dryRun}, {root: true})
    },

    async cloneDeployment({getters, dispatch, rootGetters, commit}, {deployment, environment, newDeploymentTitle, targetEnvironment, dryRun}) {
        if(rootGetters.hasPreparedMutations) {
            commit('createError', {
                message: "Can't clone deployment - there are prepared changes that haven't been committed. This is a bug.",
                context: arguments[1],
                severity: 'critical'
            })
            return
        }
        const deploymentName = deployment?.name || deployment
        const environmentName = environment?.name || environment
        const targetEnvironmentName = (targetEnvironment?.name ||  targetEnvironment || environmentName)
        const sourceDeploymentDict = getters.getDeploymentDictionary(deploymentName, environmentName)
        const deployPathName = rootGetters.lookupDeployPath(deploymentName, environmentName)?.name

        function getPreviousDeploymentName(deployPathName) {
            return deployPathName.split('/').pop()
        }

        function getNewDeploymentName(newDeploymentTitle, targetEnvironmentName) {
            let newDeploymentName =  newDeploymentTitle && slugify(newDeploymentTitle)
            if(!newDeploymentName || getters.lookupDeploymentOrDraft(newDeploymentName, targetEnvironmentName)) {
                newDeploymentName = `clone-${Date.now().toString(36)}`
            }

            return newDeploymentName
        }

        function renameDeploymentTemplate(dt, name, title) {
            dt.title = title
            dt.name = name
            dt.slug = name
        }

        if(sourceDeploymentDict && deployPathName) {
            const {DeploymentTemplate, ResourceTemplate, ApplicationBlueprint, DefaultTemplate} = sourceDeploymentDict
            const deploymentObj = _.cloneDeep({DeploymentTemplate, ResourceTemplate, ApplicationBlueprint})
            const prevDeploymentName = getPreviousDeploymentName(deployPathName)
            const newDeploymentName = getNewDeploymentName(newDeploymentTitle, targetEnvironmentName)


            deploymentObj.DeploymentTemplate = { [newDeploymentName]: deploymentObj.DeploymentTemplate[prevDeploymentName] }
            renameDeploymentTemplate(deploymentObj.DeploymentTemplate[newDeploymentName], newDeploymentName, newDeploymentTitle)

            for(const template of Object.values(deploymentObj.ResourceTemplate)) {
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
            const usePrefix = false
            const substitutions = [
                [new RegExp(`^${prevDeploymentName.replace(/-/g, '_')}__`), `${newDeploymentName.replace(/-/g, '_')}__`]
            ]
            const {transferredVariables} = await shareEnvironmentVariables(rootGetters.getHomeProjectPath, environmentName, targetEnvironmentName, variables, usePrefix, substitutions)
            transformEnvironmentVariables(deploymentObj, transferredVariables, usePrefix, substitutions)

            return await dispatch('commitClonedDeployment', {deploymentObj, deployPathName, newDeploymentName, environmentName, targetEnvironmentName, dryRun})

        }
    },

    async commitClonedDeployment({dispatch, commit, rootGetters}, {deploymentObj, deployPathName, newDeploymentName, environmentName, targetEnvironmentName, dryRun}) {
        function getDeploymentDir(deployPathName, newDeploymentName) {
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
            for(const [name, value] of Object.entries(dictionary)) {
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

    async updateProjectSubscription({rootGetters}, {projectPath, op}) {
        const dict = JSON.parse(rootGetters.lookupVariableByEnvironment('UNFURL_PROJECT_SUBSCRIPTIONS', '*') || '{}')
        const _projectPath = projectPath.toLowerCase()

        const items = dict.subscriptions[_projectPath]

        const url = `/${rootGetters.getHomeProjectPath}/-/subscriptions?upstream=${encodeURIComponent(projectPath)}`

        if(op == 'inc' && items?.length == 1) {
            console.log(`POST ${url}`)
            await axios.post(url)
        } else if(op == 'dec' && items?.length == 0) {
            console.log(`DELETE ${url}`)
            await axios.delete(url)
        }

    },

    async postQueuedProjectSubscriptions({rootGetters, dispatch}) {
        const subscriptionsStore = rootGetters.lookupVariableByEnvironment('UNFURL_PROJECT_SUBSCRIPTIONS', '*')
        if(!subscriptionsStore) return
        const dict = JSON.parse(subscriptionsStore)
        const queued = dict?.queued
        if(!(dict && queued)) return
        if(!dict.subscriptions) dict.subscriptions = {}
        const subscriptions = dict.subscriptions

        const projectPathsNeedUpdate = []

        Object.entries(queued).forEach(([projectPath, items]) => {
            let i = 0
            const _projectPath = projectPath.toLowerCase()
            if(!subscriptions[_projectPath]) subscriptions[_projectPath] = []
            for(const record of items) {
                const {resourceName, deploymentName, environmentName} = record

                if(environmentName != rootGetters.getCurrentEnvironment.name || deploymentName != rootGetters.getDeploymentTemplate.name) {
                    continue
                }

                const card = rootGetters.getCardsStacked.find(card => card.name == resourceName)
                if(!card) continue
                const hasCorrectProjectId = card.properties.some(prop => prop.name == 'project_id' && prop.value?.toLowerCase() == _projectPath)
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

    async runDeploymentHooks({state, dispatch}) {
        for(const hook of state.deploymentHooks) {
            let result = hook()
            if(typeof result?.then == 'function') {
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

    unshareResourceFromEnvironment({commit, rootGetters}, {environmentName, deploymentName, resourceName}) {
        const name = `__${environmentName}__${deploymentName}__${resourceName}`
        commit(
            'pushPreparedMutation',
            (acc) => {
                const environment = rootGetters.lookupEnvironment(environmentName)
                // TODO check if this needs to be cloned
                const patch = _.cloneDeep({...environment, instances: {...environment.instances, [name]: undefined}})
                return [{target: environmentName, patch, typename: 'DeploymentEnvironment'}];
            },
            {root: true}
        )
    },

    unshareResourceFromDefaults({commit, rootGetters}, {environmentName, deploymentName, resourceName}) {
        const name = `__${environmentName}__${deploymentName}__${resourceName}`
        commit(
            'pushPreparedMutation',
            (acc) => {
                const environment = rootGetters.getEnvironmentDefaults
                // instances is initially an object for defaults
                const patch = _.cloneDeep({...environment, instances: {...environment.instances, [name]: undefined}})
                return [{target: 'defaults', patch, typename: 'DeploymentEnvironment'}];
            },
            {root: true}
        )
    },

    async unshareResource({getters, commit, dispatch, rootGetters}, {environmentName, deploymentName, resourceName}) {
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

    shareResourceIntoEnvironment({commit, rootGetters}, {environmentName, deploymentName, resourceName}) {
        // TODO not sure we want to couple with template_resources in here
        let resource = rootGetters.getCardsStacked.find(card => card.name == resourceName)

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
            (acc) => {
                // we can use acc here because updateResourceSharedState populated the state
                //const patch = acc.DeploymentEnvironment[environmentName]
                const patch = _.cloneDeep(rootGetters.lookupEnvironment(environmentName))
                patch.instances[newObject.name] = newObject
                return [{target: environmentName, patch, typename: 'DeploymentEnvironment'}];
            },
            {root: true}
        )
    },

    shareResourcesIntoDefaults({commit, rootGetters}, {environmentName, deploymentName, resourceName}) {
        const resource = rootGetters.getCardsStacked.find(card => card.name == resourceName)

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
            (acc) => {
                const patch = _.cloneDeep(rootGetters.getEnvironmentDefaults)
                patch.instances[name] = newObject
                return [{target: 'defaults', patch, typename: 'DeploymentEnvironment'}];
            },
            {root: true}
        )
    },

    async updateResourceSharedState({getters, commit, dispatch, rootGetters}, {environmentName, deploymentName, resourceName, shareState}) {

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

    async renameDeployment({getters, commit, rootGetters, dispatch}, {deploymentName, environmentName, newTitle}) {
        const deploymentDict = getters.getDeploymentDictionary(deploymentName, environmentName)

        const deployment = Object.values(deploymentDict.Deployment)[0], deploymentTemplate = Object.values(deploymentDict.DeploymentTemplate)[0]
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

    async fetchDeployment({state, getters, commit, rootGetters, dispatch}, {deploymentName, environmentName, projectPath, branch}) {

        let deployment

        const format = 'deployment'
        const deploymentPath = rootGetters.lookupDeployPath(deploymentName, environmentName).name

        try {
            deployment = await unfurlServerExport({
                format,
                projectPath,
                deploymentPath,
                branch,
            })
        } catch(e) {
            const responseData = e.response?.data
            commit('createError', {
                message: `@fetchDeployment: An error occurred during an export request (${e.message})`,
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


        if(deployment.error) {
            commit('createError', {
                detail: `Error occured while exporting a deployment`,
                deployment: deployment.deployment,
                url: deployment.deployment.replace(/^(..\/)*/, window.location.origin + '/'),
                error: deployment.error
            })
        }

        try {
            const [deploymentName, deploymentObject] = Object.entries(deployment.Deployment)[0]

            deployment._environment = environmentName

            if(deployment.ResourceType) {
                Object.values(deployment.ResourceType).forEach(rt => localNormalize(rt, 'ResourceType', deployment))
            }

            localNormalize(deploymentObject, 'Deployment', deployment)
        } catch(e) {
            commit('createError', {
                deployment: Object.values(deployment.Deployment)[0].title,
                detail: 'Unexpected shape for deployment',
                error: e.message,
            })
        }

        commit('setDeployments', [...state.deployments, deployment])
    }

};
const getters = {
    getDeploymentDictionary(state) {
        return function(deploymentName, environmentName) {
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
    getDeploymentDictionaries(state) {
        return state.deployments
    },
    // TODO use getDeploymentsOrDrafts internally
    getDeployments(state) {
        if(!state.deployments) return []
        const result = []
        for(const dict of state.deployments) {
            if(!_.isObject(dict.Deployment)) continue
            Object.values(dict.Deployment).forEach(dep => {
                result.push({...dep, _environment: dict._environment}) // _environment assigned on fetch in environments store
            })
        }
        return result
    },
    getDeploymentsOrDrafts(state, _a, _b, rootGetters) {
        if(!state.deployments) return []
        const result = []
        for(const dict of state.deployments) {
            const deployment = _.isObject(dict.Deployment) && dict.Resource[Object.values(dict.Deployment)[0].primary]? dict.Deployment: dict.DeploymentTemplate
            if(!deployment) continue
            Object.values(deployment).forEach(dep => {
                result.push({...dep, _environment: dict._environment}) // _environment assigned on fetch in environments store
            })
        }
        for(const dashboard of rootGetters.getAdditionalDashboards || []) {
            for(const dict of dashboard?.deployments || []) {
                const deployment = _.isObject(dict.Deployment)? dict.Deployment: dict.DeploymentTemplate
                if(!deployment) continue
                result.push(Object.values(deployment)[0])
            }
        }
        return result

    },
    getDeploymentsByEnvironment(_, getters) {
        return function(environment) {
            if(!environment) {
                return getters.getDeployments
            }
            return getters.getDeployments.filter(dep => dep._environment == environment)
        }
    },

    filteredPrimariesByEnvironment(_, getters) {
        return function(environmentName, filter) {
            const result = []
            getters.getDeploymentsByEnvironment(environmentName).forEach(deployment => {
                try {
                    const dictionary = getters.getDeploymentDictionary(deployment.name, environmentName)
                    const primary = dictionary.Resource[deployment.primary]
                    const template = dictionary.ResourceTemplate[primary.template]
                    const type = dictionary.ResourceType[template.type]

                    if(filter(primary, {dictionary, type, deployment, template})) {
                        result.push({...primary, _deployment: deployment.name, _type: type})
                    }
                } catch(e) {
                    console.error(`Could not get primary as connection for ${deployment.name}`, e.message)
                }
            })
            return result
        }
    },

    getResourceSharedState(state, _a, _b, rootGetters) {
        return function(environmentName, deploymentName, resourceName) {
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

    getNextDefaultDeploymentName: (_, getters) => function(templateTitle, environment) {
        const re = new RegExp(`${templateTitle} (\\d+)`)
        let max = 1
        // use below if we want to count from one for each environment
        // for(const deployment of getters.getDeploymentsByEnvironment(environment)) {
        //
        // update - this used to use getDeployments but is now using getDeploymentsOrDrafts
        for(const deployment of getters.getDeploymentsOrDrafts) {
            let match = deployment.title.match(re)
            if(match) {
                match = parseInt(match[1])
                if(match >= max) { max = match + 1 }
            }
        }

        return `${templateTitle} ${max}`
    },
    lookupDeploymentOrDraft(_, getters) {
        return function(deploymentName, environment) {
            const _environment = environment?.name || environment
            const result = getters.getDeploymentsOrDrafts.find(dep => dep._environment == _environment && dep.name == deploymentName)
            return result
        }

    },
    lookupDeployment(_, getters) {
        return function(deploymentName, environment) {
            const deployments = environment?
                getters.getDeploymentsByEnvironment(environment) :
                getters.getDeployments
            const result = deployments.find(dep => dep.title == deploymentName || dep.name == slugify(deploymentName))
            return result
        }
    },
    listSharedResources(_, getters) {
        return function(deploymentName, environmentName) {
            const dictionary = getters.getDeploymentDictionary(deploymentName, environmentName)
            return Object.values(dictionary.Resource)
                .filter(r => getters.getResourceSharedState(environmentName, deploymentName, r.name))
        }
    },
    getSharedResource(_, getters) {
        return function(deploymentName, environmentName, resourceName) {
            const dictionary = getters.getDeploymentDictionary(deploymentName, environmentName)
            return Object.values(dictionary.Resource)
                .find(r => r.name == resourceName)
        }
    },
    getSharedResourceTemplate(_, getters) {
        return function(deploymentName, environmentName, templateName) {
            const dictionary = getters.getDeploymentDictionary(deploymentName, environmentName)
            return Object.values(dictionary.ResourceTemplate)
                .find(r => r.name == templateName)
        }
    },

    deleteDeploymentPreventedBy(_, getters) {
        return function(deploymentName, environmentName) {
            const result = []
            getters.listSharedResources(deploymentName, environmentName).forEach(
                r => result.push(`A shared resource <b>${r.title}</b> exists in this deployment.`)
            )

            return result
        }
    },

    undeployPreventedBy(_, getters) {
        return function(deploymentName, environmentName) {
            const result = []
            getters.listSharedResources(deploymentName, environmentName)
                .filter(r => !r.protected)
                .forEach(
                    r =>  result.push(`An unprotected shared resource <b>${r.title}</b> exists in this deployment.`)
                )

            return result
        }
    },
    getEnvironmentForDeployment(state, _a, _b, rootGetters) {
        return function(deploymentName, preferEnvironment) {
            const paths = rootGetters.allDeploymentPaths
            let result
            if(preferEnvironment) {
                result = paths.find(p => p.name.endsWith(`/${deploymentName}`) && p.environment == preferEnvironment)
            }
            if(!result) {
                result = paths.find(p => p.name.endsWith(`/${deploymentName}`))
            }

            return result.environment
        }
    }
};


export default {state, mutations, actions, getters};
