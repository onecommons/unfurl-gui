import {USER_HOME_PROJECT} from '../../../vue_shared/util.mjs'
import _ from 'lodash'
const state = {
    loaded: false,
    counters: {deployments: 0, applications: 0, environments: 0, stoppedDeployments: 0},
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
        await dispatch('fetchEnvironments', {fullPath: `${window.gon.current_username}/${USER_HOME_PROJECT}`});
        const items = [];
        let deployments = 0
        let applications = 0 
        let environments = 0 
        let stoppedDeployments = 0
        let applicationNames = {}

        const groups = _.groupBy(rootGetters.getDeploymentDictionaries, '_environment');
        for(const environmentName in groups) {
            environments += 1
            const environment = rootGetters.lookupEnvironment(environmentName)
            for(const deploymentDict of groups[environmentName]) {
                if(!deploymentDict.Deployment) { 
                    continue
                }
                dispatch('useProjectState', _.cloneDeep(deploymentDict))
                const deployment = rootGetters.getDeployment
                deployment.statuses = deployment.resources.filter(resource => resource.status != 1)
                deployment.isStopped = deployment.resources.some(resource => resource.state == 8)
                if(deployment.isStopped) {stoppedDeployments++} else {deployments++}
                const application = rootGetters.getApplicationBlueprint;
                applicationNames[application.name] = true

                for(const resource of rootGetters.getResources) {
                    const resourceTemplate = rootGetters.resolveResourceTemplate(resource.template);
                    const resourceType = rootGetters.resolveResourceType(resourceTemplate.type);
                    const context = {application, deployment, environment, environmentName, type: resourceType.title, resource}

                    items.push({...context, context});
                }
            }
        }
        applications = Object.keys(applicationNames).length

        commit('setDashboardItems', items)
        commit('setDashboardCounters', {deployments, applications, environments, stoppedDeployments})
        commit('setDashboardLoaded', true)
    }
}

const getters = {
    isDashboardLoaded(state) {return state.loaded},
    getDashboardItems(state) {return state.items},
    runningDeploymentsCount(state) {return state.counters.deployments},
    stoppedDeploymentsCount(state) {return state.counters.stoppedDeployments},
    environmentsCount(state) {return state.counters.environments},
    applicationsCount(state) {return state.counters.applications}

}
export default {
    state, getters, mutations, actions
}
