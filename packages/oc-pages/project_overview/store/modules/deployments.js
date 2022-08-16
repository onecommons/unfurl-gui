import gql from 'graphql-tag';
import graphqlClient from '../../graphql';
import {slugify, USER_HOME_PROJECT} from 'oc_vue_shared/util.mjs'
import {environmentVariableDependencies, prefixEnvironmentVariables} from 'oc_vue_shared/lib/deployment-template'
import {shareEnvironmentVariables} from 'oc_vue_shared/client_utils/environments'
import _ from 'lodash'

const state = {loaded: false, callbacks: [], deployments: {}, deploymentHooks: []};
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
    
    async runDeploymentHooks({state, commit}) {
        const promises = []
        for(const hook of state.deploymentHooks) {
            let result = hook()
            if(typeof result?.then == 'function') {
                result = await result
            }
            if(result === false) { return false }
        }
        return true
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
    getDeploymentsOrDrafts() {
        if(!state.deployments) return []
        const result = []
        for(const dict of state.deployments) {
            const deployment = _.isObject(dict.Deployment)? dict.Deployment: dict.DeploymentTemplate
            if(!deployment) continue
            Object.values(deployment).forEach(dep => {
                result.push({...dep, _environment: dict._environment}) // _environment assigned on fetch in environments store
            })
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
                const dictionary = getters.getDeploymentDictionary(deployment.name, environmentName)
                const primary = dictionary.Resource[deployment.primary]
                const template = dictionary.ResourceTemplate[primary.template]
                const type = dictionary.ResourceType[template.type]

                if(filter(primary, {dictionary, type, deployment, template})) {
                    result.push({...primary, _deployment: deployment.name, _type: type})
                }
            })
            return result
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
