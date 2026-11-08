import axios from '~/lib/utils/axios_utils'
import graphqlClient from 'oc/graphql_shim'
import {fetchCommit, fetchProjectInfo} from 'oc_vue_shared/client_utils/projects'
import deploymentInfo from './deployment-info'
import DeploymentItem from './deployment-info/deployment-item'

jest.mock('~/lib/utils/axios_utils', () => ({__esModule: true, default: {post: jest.fn()}}))
jest.mock('oc/graphql_shim', () => ({__esModule: true, default: {query: jest.fn()}}))
jest.mock('oc_vue_shared/client_utils/projects', () => ({fetchCommit: jest.fn(), fetchProjectInfo: jest.fn()}))

const {mutations, actions, getters} = deploymentInfo

beforeEach(() => { window.gon = {} })

describe('DeploymentItem', () => {
    const item = (extra = {}) => new DeploymentItem({
        projectPath: 'org/dash',
        environment: {name: 'prod'},
        deployment: {name: 'app', title: 'App', __typename: 'Deployment', projectPath: 'org/bp', workflow: 'deploy', status: 1, deployTime: '2026-01-02T03:04:05Z'},
        application: {blueprintPath: 'bp'},
        deployPath: {project_id: 7, pipelines: [{id: 1, commit_id: 'c1'}, {id: 2, commit: {id: 'c2'}}]},
        pipeline: {id: 2, commit: {id: 'c2'}, variables: {WORKFLOW: 'deploy'}},
        job: {id: 9, status: 'FAILED', cancelable: true},
        ...extra,
    })

    it('links to the job and its artifacts', () => {
        const i = item()
        expect(i.consoleLink).toBe('/org/dash/-/jobs/9')
        expect(i.artifactsLink).toBe('/org/dash/-/jobs/9/artifacts/browse')
        expect(i.rawLink).toBe('/org/dash/-/jobs/9/raw')
        expect(i.cancelLink).toBe('/org/dash/-/jobs/9/cancel')
        expect(item({job: null}).consoleLink).toBeUndefined()
    })

    it('reads the job status', () => {
        expect(item()).toMatchObject({jobStatus: 'failed', jobStatusIsUnsuccessful: true, jobStatusMessage: '(Failed)'})
        expect(item({job: {status: 'CANCELED'}}).jobStatusMessage).toBe('(Canceled)')
        expect(item({job: {status: 'SUCCESS'}})).toMatchObject({jobStatusIsUnsuccessful: false, jobStatusMessage: ''})
    })

    it('reads the deployment\'s state', () => {
        expect(item()).toMatchObject({isDeployed: true, isUndeployed: false, isRunning: true, isDraft: false, isEditable: false, pipelineWorkflow: 'deploy', projectId: 7, commitId: 'c2'})
        expect(item({deployment: {__typename: 'DeploymentTemplate', name: 'd'}, pipeline: null})).toMatchObject({isDraft: true, isEditable: true, isDeployed: false})
        expect(item({deployment: {name: 'a', workflow: 'undeploy'}})).toMatchObject({isUndeployed: true, isRunning: false})
    })

    it('formats when it was created', () => {
        const i = item()
        expect(i.createdAt.toISOString()).toBe('2026-01-02T03:04:05.000Z')
        expect(i.createdAtText).toBe(`${i.createdAtDate} ${i.createdAtTime}`)
        expect(item({deployment: {name: 'a'}}).createdAtText).toBe('')
    })

    it('links to the read-only and editable views', () => {
        const i = item({deployment: {name: 'app', title: 'App', projectPath: 'org/bp', blueprintPath: 'bp', branch: 'dev', __typename: 'DeploymentTemplate'}, pipeline: null})
        expect(i.readonlyLink).toBe('/org/dash/-/deployments/prod/app')
        expect(i.editableLink).toBe('/org/bp/-/overview/deployment-drafts/org%2Fdash/prod/app?fn=App&blueprintPath=bp&bprev=dev')
        expect(i.viewableLink).toBe(i.editableLink)
        expect(i.viewableTo.to.params).toEqual({name: 'app', environment: 'prod'})
    })

    it('fetches the commit of the pipeline asked for, once', async () => {
        fetchCommit.mockImplementation(async (projectId, id) => ({id}))
        const i = item()

        await expect(i.getCommit(0)).resolves.toEqual({id: 'c1'})
        await expect(i.getCommit(1)).resolves.toEqual({id: 'c2'})
        await i.getCommit(0)

        expect(fetchCommit.mock.calls).toEqual([[7, 'c1'], [7, 'c2']])
    })

    it('fetches the last pipeline\'s commit by default', async () => {
        fetchCommit.mockImplementation(async (projectId, id) => ({id}))
        await expect(item().getCommit()).resolves.toEqual({id: 'c2'})
    })

    it('has no commit without pipelines, or when the fetch fails', async () => {
        await expect(item({deployPath: {project_id: 7, pipelines: []}}).getCommit()).resolves.toBeNull()
        fetchCommit.mockRejectedValue(new Error('404'))
        await expect(item().getCommit(0)).resolves.toBeNull()
    })

    it('links to the upstream pipeline', async () => {
        fetchProjectInfo.mockResolvedValue({path_with_namespace: 'org/bp'})
        const i = item({pipeline: {id: 2, upstream_pipeline_id: 5, upstream_project_id: 3}})
        await expect(i.getUpstreamPipelineLink()).resolves.toBe('/org/bp/-/pipelines/5')
        await expect(item().getUpstreamPipelineLink()).resolves.toBeUndefined()
    })

    it('cancels a cancelable job, and refuses one that is not', async () => {
        await item().cancelJob()
        expect(axios.post).toHaveBeenCalledWith('/org/dash/-/jobs/9/cancel')
        await expect(item({job: {id: 3, cancelable: false}}).cancelJob()).rejects.toThrow('Job 3 is not cancelable')
    })

    it('unschedules a scheduled autostop', async () => {
        const i = item({autostopJob: {id: 11, status: 'SCHEDULED', scheduledAt: '2026-02-01T00:00:00Z'}})
        expect(i.autostopScheduled.toISOString()).toBe('2026-02-01T00:00:00.000Z')
        await i.cancelAutostop()
        expect(axios.post).toHaveBeenCalledWith('/org/dash/-/jobs/11/unschedule')
        await expect(item().cancelAutostop()).rejects.toThrow('is not cancelable')
    })

    it('is renamable unless generated or at the blueprint\'s own path', () => {
        expect(item().isRenamable).toBe(true)
        expect(item({deployment: {name: 'a', source: '__generated'}}).isRenamable).toBe(false)
        expect(item({deployPath: 'bp'}).isRenamable).toBe(false)
    })

    it('reads incremental deploys from the deploy path', () => {
        expect(item({deployPath: {incremental_deploy: true}}).isIncremental).toBe(true)
        expect(item().isIncremental).toBe(false)
    })
})

describe('the deployment-info store', () => {
    const jobs = {1: {id: '10', status: 'SUCCESS'}, 2: {id: '20', status: 'SCHEDULED'}}
    const context = (deployPath) => {
        const state = deploymentInfo.state()
        mutations.setJobsByPipelineId(state, jobs)
        const g = {jobByPipelineId: getters.jobByPipelineId(state)}
        return {
            state,
            getters: g,
            commit: jest.fn((name, payload) => mutations[name]?.(state, payload)),
            rootGetters: {lookupDeployPath: () => deployPath, getHomeProjectPath: 'org/dash', getCurrentNamespace: 'org'},
        }
    }
    const items = [{context: {environment: {name: 'prod'}, deployment: {name: 'app'}, application: {}}}]

    it('records an item per deployment with its latest active pipeline and job', () => {
        const ctx = context({pipelines: [{id: 1}, {id: 2, variables: {WORKFLOW: 'undeploy'}}]})
        actions.populateDeploymentItems(ctx, [...items, ...items, {context: {}}])

        const item = getters.deploymentItemDirect(ctx.state)({environment: 'prod', deployment: {name: 'app'}})
        expect(item).toBeInstanceOf(DeploymentItem)
        expect(item).toMatchObject({projectPath: 'org/dash', namespace: 'org', pipeline: {id: 1}, job: {id: '10'}})
        // a later undeploy that is still only scheduled is the autostop
        expect(item.autostop).toMatchObject({id: 2})
        expect(item.autostopJob).toMatchObject({id: '20'})

        expect(getters.deploymentItemDirect(ctx.state)({environment: 'prod', deployment: 'app'}, 'consoleLink')).toBe('/org/dash/-/jobs/10')
    })

    it('reports a deployment it cannot place', () => {
        const ctx = context(null)
        actions.populateDeploymentItems(ctx, items)
        expect(ctx.commit).toHaveBeenCalledWith('createError', expect.objectContaining({
            message: "@populateDeploymentItems(prod:app): Couldn't look up deploy path for app in prod",
        }), {root: true})
    })

    it('expects an active pipeline in the fork, but not in standalone', () => {
        const ctx = context({pipelines: [{id: 2}]})
        actions.populateDeploymentItems(ctx, items)
        expect(ctx.commit).toHaveBeenCalledWith('createError', expect.objectContaining({message: expect.stringContaining('Active pipeline expected')}), {root: true})

        window.gon.unfurl_gui = true
        const standalone = context({pipelines: [{id: 2}]})
        actions.populateDeploymentItems(standalone, items)
        expect(standalone.commit).not.toHaveBeenCalledWith('createError', expect.anything(), expect.anything())
    })

    it('indexes the jobs list by pipeline', async () => {
        graphqlClient.query.mockResolvedValue({data: {project: {pipelines: {nodes: [
            {id: 'gid://gitlab/Ci::Pipeline/5', jobs: {nodes: [{id: 'gid://gitlab/Ci::Build/50', status: 'RUNNING'}]}},
        ]}}}})
        const ctx = context(null)

        await actions.populateJobsList(ctx)

        expect(graphqlClient.query.mock.calls[0][0].variables).toEqual({fullPath: 'org/dash'})
        expect(getters.jobByPipelineId(ctx.state)('5')).toEqual({id: '50', status: 'RUNNING'})
    })
})
