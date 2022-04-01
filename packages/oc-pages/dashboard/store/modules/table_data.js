import {USER_HOME_PROJECT} from '../../../vue_shared/util.mjs'
import _ from 'lodash'
const state = {
    loaded: false,
    counters: {deployments: 0, applications: 0, environments: 0, totalDeployments: 0},
    items: []
}
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
    async loadDashboard({commit, dispatch, rootGetters}) {
        commit('setDashboardLoaded', false)
        await dispatch('ocFetchEnvironments', {fullPath: `${window.gon.current_username}/${USER_HOME_PROJECT}`});
        const items = [];
        let deployments = 0
        let applications = 0 
        let environments = 0 
        let totalDeployments = 0
        let applicationNames = {}

        const context = {}
        function pushContext(iterationCounter, i) {
            if(i == iterationCounter) {
                const item = {...context, context: {...context}} 
                items.push(item)
            }
        }
        let iterationCounter = 0

        for(const environment of rootGetters.getEnvironments) {
            Object.freeze(environment)
            context.deployment = null; context.application = null; context.resource = null; context.type = null;
            const i = ++iterationCounter
            environments += 1
            const environmentName = environment.name
            context.environment = environment
            context.environmentName = environmentName
            for(const deploymentDict of environment.deployments) {
                context.deployment = null; context.application = null; context.resource = null; context.type = null;
                let deployment
                dispatch('useProjectState', {root: _.cloneDeep(deploymentDict)})
                if(deploymentDict.Deployment) {
                    deployment = {...rootGetters.getDeployment}
                    const dt = rootGetters.resolveDeploymentTemplate(deployment.deploymentTemplate) || Object.values(deploymentDict.DeploymentTemplate)[0]
                    deployment.projectPath = dt?.projectPath
                } else {
                    deployment = Object.values(deploymentDict.DeploymentTemplate)[0]
                }
                const i = ++iterationCounter
                deployment.resources = deployment.resources?.map(r => {
                    if(typeof r == 'string') {
                        return rootGetters.resolveResource(r)
                    } else {
                        return r
                    }
                }) || []
                deployment.statuses = [deployment.resources.find(resource => resource?.name == deployment.primary)]
                if(!deployment.statuses[0]) deployment.statuses.pop()
                deployment.isStopped = deployment.resources.length == 0 || deployment.resources.some(resource => resource?.status != 1)
                if(!deployment.isStopped) deployments++
                totalDeployments++
                const application = {...rootGetters.getApplicationBlueprint};
                application.projectPath = deployment.projectPath
                // handle an export issue
                if(!application.projectIcon) {
                    try {
                        application.projectIcon = deploymentDict.Overview[application.name].projectIcon
                    } catch(e) {console.error(e)}
                }
                applicationNames[application.name] = true
                context.application = application
                context.deployment = deployment

                for(const resource of rootGetters.getResources) {
                    const i = ++iterationCounter
                    const resourceTemplate = rootGetters.resolveResourceTemplate(resource.template);
                    const resourceType = rootGetters.resolveResourceType(resourceTemplate.type);
                    context.type = resourceType?.title
                    context.resource = resource

                    pushContext()
                }

                pushContext(iterationCounter, i)
            }
            pushContext(iterationCounter, i)
        }
        applications = Object.keys(applicationNames).length

        commit('setDashboardItems', items)
        commit('setDashboardCounters', {deployments, applications, environments, totalDeployments})
        commit('setDashboardLoaded', true)
    }
}

const getters = {
    isDashboardLoaded(state) {return state.loaded},
    getDashboardItems(state) {return state.items},
    runningDeploymentsCount(state) {return state.counters.deployments},
    totalDeploymentsCount(state) {return state.counters.totalDeployments},
    environmentsCount(state) {return state.counters.environments},
    applicationsCount(state) {return state.counters.applications}

}
export default {
    state, getters, mutations, actions
}
