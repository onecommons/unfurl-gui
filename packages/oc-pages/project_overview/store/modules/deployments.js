import gql from 'graphql-tag';
import graphqlClient from '../../graphql';
import {slugify, USER_HOME_PROJECT} from 'oc_vue_shared/util.mjs'
import {environmentVariableDependencies, prefixEnvironmentVariables} from 'oc_vue_shared/lib/deployment-template'
import {shareEnvironmentVariables} from 'oc_vue_shared/client_utils/environments'
import Vue from 'vue'
import _ from 'lodash'
import axios from '~/lib/utils/axios_utils'

const state = {loaded: false, callbacks: [], deployments: {}, deploymentHooks: [], shareStates: {}};
const mutations = {
    setDeployments(state, deployments) {
        state.deployments = deployments;
        state.loaded = true
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
    // NOTE this is done in the environments store
    async fetchDeployments({commit}, params) {
        console.warn('fetch deployments has no effect and will be removed')
    },

    async createDeploymentPathPointer({commit, dispatch, rootGetters}, {projectPath, environment, deploymentDir, dryRun, environmentName}) {
        commit('setUpdateObjectPath', 'environments.json')
        commit('setUpdateObjectProjectPath', projectPath || rootGetters.getHomeProjectPath)
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

            deploymentObj.DeploymentTemplate[newDeploymentName] = deploymentObj.DeploymentTemplate[prevDeploymentName]
            renameDeploymentTemplate(deploymentObj.DeploymentTemplate[newDeploymentName], newDeploymentName, newDeploymentTitle)
            delete deploymentObj.DeploymentTemplate[prevDeploymentName]

            if(targetEnvironmentName != environmentName) {
                const variables = environmentVariableDependencies(deploymentObj)
                const {patch, prefix} = await shareEnvironmentVariables(rootGetters.getHomeProjectPath, environmentName, targetEnvironmentName, variables)
                prefixEnvironmentVariables(deploymentObj, prefix)
            }

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
        const objectPath = `${deploymentDir}/deployment.json`

        commit('useBaseState', {}, {root: true})
        commit('setUpdateObjectProjectPath', rootGetters.getHomeProjectPath, {root:true})
        commit('setUpdateObjectPath', objectPath, {root: true})
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
        if(dryRun) {
            commit('clearPreparedMutations', null, {root:true})
        }
        await dispatch('createDeploymentPathPointer', {environment: targetEnvironmentName, deploymentDir, dryRun})
        return newDeploymentName
    },

        /*
         [
            {
            "id": 387,
            "name": "buildpack-test-app",
            "full_path": "/user-2022-09-28T21-36-42/buildpack-test-app",
            "full_name": "user-2022-09-28T21-36-42 / buildpack-test-app"
            }
        ]

        axios.post(`/user-2022-09-28T21-36-42/dashboard/-/subscriptions?upstream=${encodeURIComponent('user-2022-09-28T21-36-42/buildpack-test-app')}`)
    */
    async updateProjectSubscription({rootGetters}, {projectPath, op}) {
        const dict = JSON.parse(rootGetters.lookupVariableByEnvironment('UNFURL_PROJECT_SUBSCRIPTIONS', '*') || '{}')

        const items = dict.subscriptions[projectPath]

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
        const dict = JSON.parse(rootGetters.lookupVariableByEnvironment('UNFURL_PROJECT_SUBSCRIPTIONS', '*'))
        const queued = dict?.queued
        if(!(dict && queued)) return 
        if(!dict.subscriptions) dict.subscriptions = {}
        const subscriptions = dict.subscriptions
        
        const projectPathsNeedUpdate = []
        
        Object.entries(queued).forEach(([projectPath, items]) => {
            let i = 0
            if(!subscriptions[projectPath]) subscriptions[projectPath] = [] 
            for(const record of items) {
                const {resourceName, deploymentName, environmentName} = record

                if(environmentName != rootGetters.getCurrentEnvironment.name || deploymentName != rootGetters.getDeploymentTemplate.name) {
                    continue
                }

                const card = rootGetters.getCardsStacked.find(card => card.name == resourceName)
                const hasCorrectProjectId = card.properties.some(prop => prop.name == 'project_id' && prop.value == projectPath)
                if(card && hasCorrectProjectId) {
                    subscriptions[projectPath].push(record)
                    i++
                }
            }
            if(i > 0) {
                projectPathsNeedUpdate.push(projectPath)
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
    
    async runDeploymentHooks({state, commit, rootGetters, dispatch}) {
        const promises = []
        for(const hook of state.deploymentHooks) {
            let result = hook()
            if(typeof result?.then == 'function') {
                result = await result
            }
            if(result === false) { return false }
        }
        await dispatch('postQueuedProjectSubscriptions')
        return true
    },

    unshareResourceFromEnvironment({commit, rootGetters}, {environmentName, deploymentName, resourceName}) {
        commit(
            'pushPreparedMutation',
            (acc) => {
                const environment = rootGetters.lookupEnvironment(environmentName)
                const instances = environment.instances.filter(instance => instance.name != `__${environmentName}__${deploymentName}__${resourceName}`)
                const patch = _.cloneDeep({...environment, instances})
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
                const instances = Object.values(environment.instances).filter(instance => instance.name != name)
                const patch = _.cloneDeep({...environment, instances})
                return [{target: 'defaults', patch, typename: 'DeploymentEnvironment'}];
            },
            {root: true}
        )
    },

    async unshareResource({getters, commit, dispatch, rootGetters}, {environmentName, deploymentName, resourceName}) {
        const currentShareState = getters.getResourceSharedState(environmentName, deploymentName, resourceName)
        if(!currentShareState) return

        commit('setShareState', {shareState: null, name: `__${environmentName}__${deploymentName}__${resourceName}` })

        commit('useBaseState', {}, {root: true})
        commit('setCommitMessage', `Unshare ${resourceName}`, {root: true})
        commit('setUpdateObjectProjectPath', rootGetters.getHomeProjectPath, {root:true})
        commit('setUpdateObjectPath', 'environments.json', {root: true})


        if(currentShareState == 'environment') {
            dispatch('unshareResourceFromEnvironment', {environmentName, deploymentName, resourceName})
        } else if (currentShareState == 'dashboard') {
            dispatch('unshareResourceFromDefaults', {environmentName, deploymentName, resourceName})
        }

        await dispatch('commitPreparedMutations')
    },

    shareResourceIntoEnvironment({commit, rootGetters}, {environmentName, deploymentName, resourceName}) {
        // TODO not sure we want to couple with template_resources in here
        const resource = rootGetters.getCardsStacked.find(card => card.name == resourceName)

        const newObject = {
            name: `__${environmentName}__${deploymentName}__${resourceName}`,
            title: resource.title,
            directives: ['select'],
            imported: `${deploymentName}:${resource.name}`,
            type: resource.type,
            __typename: 'ResourceTemplate'
        }

        commit(
            'pushPreparedMutation',
            (acc) => {
                // we can use acc here because updateResourceSharedState populated the state
                //const patch = acc.DeploymentEnvironment[environmentName]
                const patch = _.cloneDeep(rootGetters.lookupEnvironment(environmentName))
                patch.instances.push(newObject)
                return [{target: environmentName, patch, typename: 'DeploymentEnvironment'}];
            },
            {root: true}
        )
    },

    shareResourcesIntoDefaults({commit, rootGetters}, {environmentName, deploymentName, resourceName}) {
        const resource = rootGetters.getCardsStacked.find(card => card.name == resourceName)

        const name = `__${environmentName}__${deploymentName}__${resourceName}`
        const newObject = {
            name,
            title: resource.title,
            directives: ['select'],
            imported: `${deploymentName}:${resource.name}`,
            type: resource.type,
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

        commit('useBaseState', {}, {root: true})
        commit('setCommitMessage', `Share ${resourceName} with ${shareState}`, {root: true})
        commit('setUpdateObjectProjectPath', rootGetters.getHomeProjectPath, {root:true})
        commit('setUpdateObjectPath', 'environments.json', {root: true})


        // It's more difficult to clean this up, because we add the manifest per deployment
        // removing it on removal of the shared resource could break the use of other shared resources
        /*
        commit(
            'pushPreparedMutation',
            (acc) => {
                const patch = _.cloneDeep(rootGetters.lookupEnvironment(environmentName))
                const external = patch.external || {}
                const manifest = rootGetters.lookupDeployPath(deploymentName, environmentName)?.name
                external[deploymentName] = {
                    manifest,
                    instance: "*"
                }
                patch.external = external
                return [{target: environmentName, patch, typename: 'DeploymentEnvironment'}];
            },
            {root: true}
        )
        */

        if(shareState == 'environment') {
            dispatch('shareResourceIntoEnvironment', {environmentName, deploymentName, resourceName})
        } else if (shareState == 'dashboard') {
            dispatch('shareResourcesIntoDefaults', {environmentName, deploymentName, resourceName})
        }

        await dispatch('commitPreparedMutations')
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
            const deployment = _.isObject(dict.Deployment)? dict.Deployment: dict.DeploymentTemplate
            if(!deployment) continue
            Object.values(deployment).forEach(dep => {
                result.push({...dep, _environment: dict._environment}) // _environment assigned on fetch in environments store
            })
        }
        for(const dashboard of rootGetters.getAdditionalDashboards) {
            for(const dict of dashboard.deployments) {
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
    }
};


export default {state, mutations, actions, getters};
