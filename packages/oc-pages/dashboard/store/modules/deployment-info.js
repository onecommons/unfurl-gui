import DeploymentItem from './deployment-info/deployment-item'
import gql from 'graphql-tag'
import graphqlClient from '../../graphql'
import _ from 'lodash'

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


const state = () => ({
    deploymentItems: {},
    jobsByPipelineId: {}
})

const getters = {
    deploymentItemDirect(state) {
        return function({environment, deployment}, method, ...args) {
            const key = `${environment?.name || environment}:${deployment?.name || deployment}`
            let result = state.deploymentItems[key]
            if(result && method) {
                if(args.length) {
                    result = result[method](...args)
                } else {
                    result = result[method]
                }
            }
            return result
        }
    },
    jobByPipelineId(state) {
        return function(pipelineId) {
            return state.jobsByPipelineId[pipelineId]
        }
    }
}

const mutations = {
    setDeploymentItems(state, deploymentItems) {
        state.deploymentItems = deploymentItems
    },
    setJobsByPipelineId(state, jobsByPipelineId) {
        state.jobsByPipelineId = jobsByPipelineId
    }
}

const actions = {
    populateDeploymentItems({state, getters, rootGetters, commit}, items) {
        const dict = {}
        for(const item of items) {
            let itemKey
            try {
                itemKey = `${item.context.environment.name}:${item.context.deployment.name}`
            } catch(e) {continue}
            if(!dict[itemKey]) {
                function recordDeploymentItem() {
                    const context = {}
                    context.environment = item.context.environment
                    context.deployment = item.context.deployment
                    context.application = item.context.application
                    context.deployPath = rootGetters.lookupDeployPath(context.deployment.name, context.environment.name)

                    if(!context.deployPath) throw new Error(`Couldn't look up deploy path for ${context.deployment.name} in ${context.environment.name}`)

                    let [pipeline, jobInfo] = context.deployPath?.pipelines
                        .map(p => [p, getters.jobByPipelineId(p.id)])
                        .filter(([_, jobInfo]) => jobInfo && !['SCHEDULED', 'MANUAL'].includes(jobInfo.status))
                        .pop() || []


                    const lastPipeline = _.last(context.deployPath?.pipelines)

                    if(lastPipeline?.variables?.WORKFLOW == 'undeploy' && pipeline.id != lastPipeline.id) {
                        context.autostop = lastPipeline
                        context.autostopJob = getters.jobByPipelineId(lastPipeline.id)
                    }

                    context.job = jobInfo || getters.jobByPipelineId(lastPipeline?.id)
                    context.pipeline = pipeline  || lastPipeline
                    context.projectPath = rootGetters.getHomeProjectPath
                    context.namespace = rootGetters.getCurrentNamespace
                    dict[itemKey] = new DeploymentItem(context)
                }

                try {
                    recordDeploymentItem()
                } catch({message}) {
                    commit(
                        'createError', {
                            message,
                            severity: 'major',
                            context: item
                    }, {root: true})
                }
            }
        }
        commit('setDeploymentItems', dict)
    },
    async populateJobsList({rootGetters, commit}) {
        let result

        // #!if
        result = await graphqlClient.defaultClient.query({
            query: LOOKUP_JOBS,
            fetchPolicy: 'network-only',
            variables: {fullPath: rootGetters.getHomeProjectPath}
        })
        // #!endif

        const newJobsByPipelineId = {}
        for(const pipeline of result?.data?.project?.pipelines?.nodes || []) {
            const pipelineId = pipeline.id.split('/').pop()
            for(const job of pipeline.jobs.nodes) {
                const jobId = job.id.split('/').pop()
                newJobsByPipelineId[pipelineId] = Object.freeze({...job, id: jobId})
            }
        }
        commit('setJobsByPipelineId', newJobsByPipelineId)
    }
}

export default {
    state, getters, mutations, actions
}
