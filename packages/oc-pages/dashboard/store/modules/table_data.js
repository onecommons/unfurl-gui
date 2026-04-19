import {deepFreeze} from 'oc_vue_shared/client_utils/misc'
import {fetchProjectInfo} from 'oc_vue_shared/client_utils/projects'
import {useImportedStateOnBreakpointOrElse} from 'oc_vue_shared/storage-keys'

import _ from 'lodash'
const state = () => ({
    loaded: false,
    counters: {deployments: 0, applications: 0, environments: 0, totalDeployments: 0},
    items: []
})

const mutations = {
    setDashboardLoaded(state, loaded) {
        state.loaded = loaded
    },
    setDashboardCounters(state, counters) {
        state.counters = counters
    },
    setDashboardItems(state, items) {
        state.items = items
    }
}
const actions = {
    async loadDashboard({commit, dispatch, rootGetters}, options={}) {
        commit('setDashboardLoaded', false)

        await useImportedStateOnBreakpointOrElse('loadDashboard', async() => {
            await dispatch('ocFetchEnvironments', {fullPath: rootGetters.getHomeProjectPath});
        })

        const items = [];
        let deployments = 0
        let applications = 0
        let environmentsCount = 0
        let totalDeployments = 0
        let applicationNames = {}

        const context = {}
        function pushContext(id, iterationCounter, i) {
            if(i == iterationCounter) {
                const item = {id, ...context, context: {...context}}
                Object.freeze(item.context)
                Object.freeze(item)
                items.push(item)
            }
        }
        let iterationCounter = 0

        const environments = rootGetters.getEnvironments


        if(rootGetters.getDeploymentDictionaries.some(dep => dep._environment == 'defaults')) {
            environments.push(rootGetters.lookupEnvironment('defaults'))
        }

        for(const environment of rootGetters.getEnvironments) {
            deepFreeze(environment)
            context.deployment = null; context.application = null; context.resource = null; context.type = null;
            const i = ++iterationCounter
            environmentsCount += 1
            const environmentName = environment.name
            context.environment = environment
            context.environmentName = environmentName
            for(const frozenDeploymentDict of rootGetters.getDeploymentDictionaries.filter(dep => dep._environment == environmentName)) {

                context.deployment = null; context.application = null; context.resource = null; context.type = null;
                let deployment
                let projectPath

                try {
                    projectPath = Object.values(frozenDeploymentDict.DeploymentTemplate)[0].projectPath
                } catch(context) {
                    commit('createError', {message: `@loadDashboard: Couldn't find project path`, severity: 'minor', context})
                }

                if(frozenDeploymentDict.Deployment && frozenDeploymentDict.Resource[Object.values(frozenDeploymentDict.Deployment)[0].primary]) {
                    deployment = {...Object.values(frozenDeploymentDict.Deployment)[0]}
                    const dt = frozenDeploymentDict.DeploymentTemplate[deployment.deploymentTemplate]
                    // ensure that these properties are always available when set
                    deployment.projectPath = dt?.projectPath
                    deployment.branch = dt?.branch
                } else {
                    deployment = Object.values(frozenDeploymentDict.DeploymentTemplate)[0]
                }

                // does not account for delayed pipelines
                // there is no reason to delay a "system deployment" though
                const pipeline = rootGetters.lookupLastRecordedPipeline(deployment.name, environmentName)
                if(pipeline?.variables?.SYSTEM_DEPLOYMENT) {
                    continue
                }

                const i = ++iterationCounter

                const resources = Object.values(frozenDeploymentDict.Resource || {}).filter(r => r.visibility != 'hidden')

                const deploymentPrimary = resources.find(resource => resource?.name == deployment.primary)

                deepFreeze(deployment)

                if(deployment.__typename == 'Deployment' && deployment.status == 1) {
                    deployments++
                }
                totalDeployments++
                const application = {...Object.values(frozenDeploymentDict['ApplicationBlueprint'])[0]}
                application.projectPath = deployment.projectPath

                if(!application.projectIcon && application.projectPath && application.projectPath != '.') {
                    try {
                        application.projectIcon = fetchProjectInfo(encodeURIComponent(application.projectPath)).then(projectInfo => projectInfo?.avatar_url)
                    } catch(e) {
                        commit('createError', {message: `@loadDashboard: Couldn't fetch project icon for ${application.projectPath}`, severity: 'minor', context: e})
                    }
                }

                deepFreeze(application)

                applicationNames[application.name] = true
                context.application = application
                context.deployment = deployment

                for(const resource of resources) {
                    const i = ++iterationCounter
                    deepFreeze(resource)
                    context.resource = resource

                    context.type = frozenDeploymentDict['ResourceTemplate'][resource.template]?.type?.split('@')?.shift()

                    pushContext([environmentName, deployment.name, resource.name].join('.'))
                }

                pushContext([environmentName, deployment.name].join('.'), iterationCounter, i)
            }
            pushContext(environmentName, iterationCounter, i)
        }
        applications = Object.keys(applicationNames).length

        commit('setDashboardItems', items)
        commit('setDashboardCounters', {deployments, applications, environments: environmentsCount, totalDeployments})
        commit('setDashboardLoaded', true)
    }
}

const getters = {
    isDashboardLoaded(state) {return state.loaded},
    getDashboardItems(state) {return state.items},
    runningDeploymentsCount(state) {return state.counters.deployments},
    totalDeploymentsCount(state, _a, _b, rootGetters) {return state.counters.totalDeployments + rootGetters.mergeRequests.length},
    environmentsCount(state) {return state.counters.environments},
    applicationsCount(state) {return state.counters.applications}
}

export default {
    state, getters, mutations, actions
}
