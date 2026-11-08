import type {ActionContext, Module} from '@gitlab/vuex-vue3'
import DeploymentItem from './deployment-info/deployment-item'
import type {DeploymentItemContext} from './deployment-info/deployment-item'
import type {DashboardItem} from './table_data'
import gql from 'graphql-tag'
import graphqlClient from 'oc/graphql_shim'
import _ from 'lodash'
import {freeze} from 'oc_vue_shared/client_utils/misc'

const LOOKUP_JOBS = gql`
    query lookupJobs($fullPath: ID!){
        project(fullPath: $fullPath){
            name
            pipelines {
                count
                nodes {
                    id
                    jobs {
                        count
                        nodes {
                            id
                            status
                            cancelable
                            scheduledAt
                        }
                    }
                }
            }
        }
    }
`


// A CI job, as the jobs list query returns it.
interface Job {
    id: string
    status: string
    cancelable?: boolean
    scheduledAt?: string
}

interface State {
    // keyed `${environment}:${deployment}`
    deploymentItems: Record<string, DeploymentItem>
    jobsByPipelineId: Record<string, Job>
}

type Named = {name: string} | string | undefined

const state = (): State => ({
    deploymentItems: {},
    jobsByPipelineId: {}
})

const getters = {
    // the item, or with `method` one of its members: called with args, read without
    deploymentItemDirect(state: State) {
        return function({environment, deployment}: {environment: Named, deployment: Named}, method?: string, ...args: unknown[]): any {
            const key = `${(environment as {name?: string})?.name || environment}:${(deployment as {name?: string})?.name || deployment}`
            const item = state.deploymentItems[key] as unknown as Record<string, any> | undefined
            if(item && method) {
                return args.length ? item[method](...args) : item[method]
            }
            return item
        }
    },
    jobByPipelineId(state: State) {
        return function(pipelineId: string | number) {
            return state.jobsByPipelineId[pipelineId]
        }
    }
}

const mutations = {
    setDeploymentItems(state: State, deploymentItems: State['deploymentItems']) {
        state.deploymentItems = deploymentItems
    },
    setJobsByPipelineId(state: State, jobsByPipelineId: State['jobsByPipelineId']) {
        state.jobsByPipelineId = jobsByPipelineId
    }
}

const actions = {
    populateDeploymentItems({getters, rootGetters, commit}: ActionContext<State, any>, items: DashboardItem[]) {
        const dict: State['deploymentItems'] = {}
        const errors: Record<string, boolean> = {}
        for(const item of items) {
            let itemKey
            try {
                itemKey = `${item.context.environment!.name}:${item.context.deployment!.name}`
            } catch(e) {continue}
            if(!dict[itemKey] && !errors[itemKey]) {
                const recordDeploymentItem = () => {
                    const context = {} as DeploymentItemContext
                    context.environment = item.context.environment!
                    context.deployment = item.context.deployment!
                    context.application = item.context.application!
                    context.deployPath = rootGetters.lookupDeployPath(context.deployment.name, context.environment.name)

                    if(!context.deployPath) throw new Error(`Couldn't look up deploy path for ${context.deployment.name} in ${context.environment.name}`)

                    const [pipeline, jobInfo] = (context.deployPath?.pipelines as DeploymentItemContext['pipeline'][])
                        .map(p => [p, getters.jobByPipelineId(p!.id)] as const)
                        .filter(([_, jobInfo]) => jobInfo && !['SCHEDULED', 'MANUAL'].includes(jobInfo.status))
                        .pop() || []


                    if((context.deployPath?.pipelines?.length || 0) > 0 && !pipeline) {
                        if(!window.gon.unfurl_gui) {
                            throw new Error('Active pipeline expected, but not found')
                        }
                    }

                    if(pipeline) {
                        const lastPipeline: DeploymentItemContext['pipeline'] = _.last(context.deployPath?.pipelines)

                        if(lastPipeline?.variables?.WORKFLOW == 'undeploy' && pipeline.id != lastPipeline.id) {
                            context.autostop = lastPipeline
                            context.autostopJob = getters.jobByPipelineId(lastPipeline.id)
                        }

                        context.job = jobInfo || getters.jobByPipelineId(lastPipeline?.id)
                        context.pipeline = pipeline  || lastPipeline
                    }

                    context.projectPath = rootGetters.getHomeProjectPath
                    context.namespace = rootGetters.getCurrentNamespace
                    dict[itemKey] = new DeploymentItem(context)
                }

                try {
                    recordDeploymentItem()
                } catch(e) {
                    const {message} = e as Error
                    commit(
                        'createError', {
                            message: `@populateDeploymentItems(${itemKey}): ${message}`,
                            severity: 'major',
                            context: item.context
                    }, {root: true})
                    errors[itemKey] = true
                }
            }
        }
        commit('setDeploymentItems', dict)
    },
    async populateJobsList({rootGetters, commit}: ActionContext<State, any>) {
        let result

        // #!if !standalone
        result = await graphqlClient.query({
            query: LOOKUP_JOBS,
            fetchPolicy: 'network-only',
            variables: {fullPath: rootGetters.getHomeProjectPath}
        })
        // #!endif

        const newJobsByPipelineId: State['jobsByPipelineId'] = {}
        for(const pipeline of result?.data?.project?.pipelines?.nodes || []) {
            const pipelineId = pipeline.id.split('/').pop()
            for(const job of pipeline.jobs.nodes) {
                const jobId = job.id.split('/').pop()
                newJobsByPipelineId[pipelineId] = freeze({...job, id: jobId})
            }
        }
        commit('setJobsByPipelineId', newJobsByPipelineId)
    }
}

export default {
    state, getters, mutations, actions
} satisfies Module<State, any>
