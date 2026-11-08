import {deepFreeze, freeze} from 'oc_vue_shared/client_utils/misc'
import {fetchProjectInfo} from 'oc_vue_shared/client_utils/projects'
import {useImportedStateOnBreakpointOrElse} from 'oc_vue_shared/storage-keys'

import type {ActionContext, Module} from '@gitlab/vuex-vue3'

// The unfurl export JSON; typed loosely until the payload types exist.
type Json = Record<string, any>

interface Counters {
    deployments: number
    applications: number
    environments: number
    totalDeployments: number
}

// One row of the dashboard table: a leaf, carrying the context above it.
export interface DashboardItem {
    id: string
    environment?: Json
    environmentName?: string
    deployment?: Json | null
    application?: Json | null
    resource?: Json | null
    type?: string | null
    context: Omit<DashboardItem, 'id' | 'context'>
}

interface State {
    loaded: boolean
    counters: Counters
    items: DashboardItem[]
}

const state = (): State => ({
    loaded: false,
    counters: {deployments: 0, applications: 0, environments: 0, totalDeployments: 0},
    items: []
})

const mutations = {
    setDashboardLoaded(state: State, loaded: boolean) {
        state.loaded = loaded
    },
    setDashboardCounters(state: State, counters: Counters) {
        state.counters = counters
    },
    setDashboardItems(state: State, items: DashboardItem[]) {
        state.items = items
    }
}
const actions = {
    async loadDashboard({commit, dispatch, rootGetters}: ActionContext<State, any>) {
        commit('setDashboardLoaded', false)

        await useImportedStateOnBreakpointOrElse('loadDashboard', async() => {
            await dispatch('ocFetchEnvironments', {fullPath: rootGetters.getHomeProjectPath});
        })

        const items: DashboardItem[] = [];
        let deployments = 0
        let applications = 0
        let environmentsCount = 0
        let totalDeployments = 0
        const applicationNames: Record<string, boolean> = {}

        const context: DashboardItem['context'] = {}
        // only a leaf is pushed: called without counters (a resource), or when
        // nothing below bumped the counter since this level took its index
        function pushContext(id: string, iterationCounter?: number, i?: number) {
            if(i == iterationCounter) {
                const item: DashboardItem = {id, ...context, context: {...context}}
                freeze(item.context)
                freeze(item)
                items.push(item)
            }
        }
        let iterationCounter = 0

        /*
         * A copy: getEnvironments hands back state.projectEnvironments itself,
         * so pushing onto it appended 'defaults' to the store for good -- once
         * per loadDashboard, from an action rather than a mutation. Vuex 4's
         * strict mode reports it; the duplicates were there before it did.
         */
        const environments: Json[] = [...rootGetters.getEnvironments]

        if(rootGetters.getDeploymentDictionaries.some((dep: Json) => dep._environment == 'defaults')) {
            environments.push(rootGetters.lookupEnvironment('defaults'))
        }

        for(const environment of environments) {
            deepFreeze(environment)
            context.deployment = null; context.application = null; context.resource = null; context.type = null;
            const i = ++iterationCounter
            environmentsCount += 1
            const environmentName = environment.name
            context.environment = environment
            context.environmentName = environmentName
            for(const frozenDeploymentDict of rootGetters.getDeploymentDictionaries.filter((dep: Json) => dep._environment == environmentName) as Json[]) {

                context.deployment = null; context.application = null; context.resource = null; context.type = null;
                let deployment: Json
                let projectPath

                try {
                    projectPath = (Object.values(frozenDeploymentDict.DeploymentTemplate)[0] as Json).projectPath
                } catch(context) {
                    commit('createError', {message: `Load dashboard: Couldn't find project path`, severity: 'minor', context})
                }

                if(frozenDeploymentDict.Deployment && frozenDeploymentDict.Resource[(Object.values(frozenDeploymentDict.Deployment)[0] as Json).primary]) {
                    deployment = {...Object.values(frozenDeploymentDict.Deployment)[0] as Json}
                    const dt = frozenDeploymentDict.DeploymentTemplate[deployment.deploymentTemplate]
                    // ensure that these properties are always available when set
                    deployment.projectPath = dt?.projectPath
                    deployment.branch = dt?.branch
                } else {
                    deployment = Object.values(frozenDeploymentDict.DeploymentTemplate)[0] as Json
                }

                // does not account for delayed pipelines
                // there is no reason to delay a "system deployment" though
                const pipeline = rootGetters.lookupLastRecordedPipeline(deployment.name, environmentName)
                if(pipeline?.variables?.SYSTEM_DEPLOYMENT) {
                    continue
                }

                const i = ++iterationCounter

                const resources = (Object.values(frozenDeploymentDict.Resource || {}) as Json[]).filter(r => r.visibility != 'hidden')

                const deploymentPrimary = resources.find(resource => resource?.name == deployment.primary)

                deepFreeze(deployment)

                if(deployment.__typename == 'Deployment' && deployment.status == 1) {
                    deployments++
                }
                totalDeployments++
                const application: Json = {...Object.values(frozenDeploymentDict['ApplicationBlueprint'])[0] as Json}
                application.projectPath = deployment.projectPath

                if(!application.projectIcon && application.projectPath && application.projectPath != '.') {
                    try {
                        application.projectIcon = fetchProjectInfo(encodeURIComponent(application.projectPath)).then(projectInfo => projectInfo?.avatar_url)
                    } catch(e) {
                        commit('createError', {message: `Load dashboard: Couldn't fetch project icon for ${application.projectPath}`, severity: 'minor', context: e})
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
    isDashboardLoaded(state: State) {return state.loaded},
    getDashboardItems(state: State) {return state.items},
    runningDeploymentsCount(state: State) {return state.counters.deployments},
    totalDeploymentsCount(state: State, _a: unknown, _b: unknown, rootGetters: any) {return state.counters.totalDeployments + rootGetters.mergeRequests.length},
    environmentsCount(state: State) {return state.counters.environments},
    applicationsCount(state: State) {return state.counters.applications}
}

export default {
    state, getters, mutations, actions
} satisfies Module<State, any>
