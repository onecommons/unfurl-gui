import {USER_HOME_PROJECT} from 'oc_vue_shared/util.mjs'
import {deepFreeze} from 'oc_vue_shared/client_utils/misc'

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
        const {fetchPolicy} = options
        commit('setDashboardLoaded', false)
        await dispatch('ocFetchEnvironments', {fullPath: rootGetters.getHomeProjectPath, fetchPolicy});
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
                Object.freeze(item.context)
                Object.freeze(item)
                items.push(item)
            }
        }
        let iterationCounter = 0

        for(const environment of rootGetters.getEnvironments) {
            deepFreeze(environment)
            context.deployment = null; context.application = null; context.resource = null; context.type = null;
            const i = ++iterationCounter
            environments += 1
            const environmentName = environment.name
            context.environment = environment
            context.environmentName = environmentName
            for(const frozenDeploymentDict of rootGetters.getDeploymentDictionaries.filter(dep => dep._environment == environmentName)) {
                console.log(frozenDeploymentDict)
                context.deployment = null; context.application = null; context.resource = null; context.type = null;
                let deployment
                const clonedDeploymentDict = _.cloneDeep(frozenDeploymentDict)

                let projectPath
                try {
                    projectPath = Object.values(frozenDeploymentDict.DeploymentTemplate)[0].projectPath
                } catch(e) {
                    console.error(e)
                }

                dispatch('useProjectState', {root: clonedDeploymentDict, projectPath})
                if(clonedDeploymentDict.Deployment) {
                    deployment = {...rootGetters.getDeployment}
                    const dt = rootGetters.resolveDeploymentTemplate(deployment.deploymentTemplate) || Object.values(clonedDeploymentDict.DeploymentTemplate)[0]
                    deployment.projectPath = dt?.projectPath
                } else {
                    deployment = Object.values(clonedDeploymentDict.DeploymentTemplate)[0]
                }
                const i = ++iterationCounter
                deployment.resources = deployment.resources?.map(r => {
                    if(typeof r == 'string') {
                        return rootGetters.resolveResource(r)
                    } else {
                        return r
                    }
                }) || []

                const deploymentPrimary = deployment.resources.find(resource => resource?.name == deployment.primary)
                // TODO remove deployment.statuses
                if(deploymentPrimary) {
                    deployment.statuses = [deploymentPrimary]
                    let urlAttribute
                    if(!deployment.url && (urlAttribute = deploymentPrimary.attributes.find(a => a.name == 'url'))) {
                        deployment.url = urlAttribute.value
                    }
                } else {
                    deployment.statuses = []
                }

                // TODO share this logic
                deployment.resources = deployment.resources.filter(r => {
                    return r.visibility != 'hidden' 
                })

                deepFreeze(deployment)

                if(deployment.__typename == 'Deployment' && deployment.status == 1) {
                    deployments++
                }
                totalDeployments++
                const application = {...rootGetters.getApplicationBlueprint};
                application.projectPath = deployment.projectPath
                // handle an export issue
                if(!application.projectIcon) {
                    try {
                        application.projectIcon = clonedDeploymentDict.Overview[application.name].projectIcon
                    } catch(e) {}
                }

                deepFreeze(application) 

                applicationNames[application.name] = true
                context.application = application
                context.deployment = deployment

                //for(const resource of rootGetters.getResources) {
                for(const resource of deployment.resources) {
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
