import axios from '~/lib/utils/axios_utils'
import {visitUrl} from '~/lib/utils/url_utility'
import {getOrFetchDefaultBranch} from './projects'
import {
    triggerPipeline, triggerAtomicDeployment, prepareVariables, triggerIncrementalDeployment,
    getJobsPath, redirectToJobConsole, lookupPipelineJobs,
} from './pipelines'

jest.mock('~/lib/utils/axios_utils', () => ({__esModule: true, default: {get: jest.fn(), post: jest.fn()}}))
jest.mock('~/lib/utils/url_utility', () => ({visitUrl: jest.fn()}))
jest.mock('./projects', () => ({getOrFetchDefaultBranch: jest.fn()}))

// jest.config resets mock implementations before each test
beforeEach(() => {
    getOrFetchDefaultBranch.mockResolvedValue('main')
    sessionStorage.clear()
})

const byKey = attributes => Object.fromEntries(attributes.map(a => [a.key, a]))

describe('prepareVariables', () => {
    it('sends each set variable as both value and secret_value, dropping the unset', async () => {
        const vars = byKey(await prepareVariables({
            workflow: 'deploy', projectUrl: 'https://x/org/bp', environmentName: 'prod',
            deployPath: 'environments/prod/app', deploymentName: 'app', deploymentBlueprint: 'aws',
        }))

        expect(vars.WORKFLOW).toEqual({key: 'WORKFLOW', masked: false, secret_value: 'deploy', value: 'deploy', variable_type: 'unencrypted_var'})
        expect(vars.DEPLOY_ENVIRONMENT.value).toBe('prod')
        expect(vars.DEPLOYMENT_BLUEPRINT.value).toBe('aws')
        expect(vars).not.toHaveProperty('UPSTREAM_COMMIT')
        expect(vars).not.toHaveProperty('USE_DEPLOYMENT_BLUEPRINT')
        expect(vars).not.toHaveProperty('EXTRA_WORKFLOW_ARGS')
    })

    it('opts out of a deployment blueprint when there is none', async () => {
        const vars = byKey(await prepareVariables({workflow: 'deploy'}))
        expect(vars.USE_DEPLOYMENT_BLUEPRINT.value).toBe("--use-deployment-blueprint ''")
    })

    // the CI template word-splits $EXTRA_WORKFLOW_ARGS onto the unfurl command line
    it('separates extra workflow args with a space', async () => {
        const vars = byKey(await prepareVariables({workflow: 'deploy', forceCheck: true, dryRun: true}))
        expect(vars.EXTRA_WORKFLOW_ARGS.value).toBe('--check --dryrun')
    })

    it('traces a mock deploy, and reads image and validation overrides from the session', async () => {
        sessionStorage['deploy-image'] = 'img:1'
        sessionStorage['unfurl-validation-mode'] = 'strict'
        const vars = byKey(await prepareVariables({workflow: 'deploy', mockDeploy: true}))
        expect(vars.UNFURL_MOCK_DEPLOY.value).toBe('true')
        expect(vars.UNFURL_LOGGING.value).toBe('trace')
        expect(vars.DEPLOY_IMAGE.value).toBe('img:1')
        expect(vars.UNFURL_VALIDATION_MODE.value).toBe('strict')
    })

    it('passes extra variables through, stringifying numbers', async () => {
        const vars = byKey(await prepareVariables({workflow: 'deploy', RETRIES: 3}))
        expect(vars.RETRIES.value).toBe('3')
    })

    it('sends the blueprint credentials as env vars, the token masked if named so', async () => {
        const vars = byKey(await prepareVariables({workflow: 'deploy', writableBlueprintProjectUrl: 'https://w', blueprintToken: 'tok'}))
        expect(vars.WRITABLE_BLUEPRINT_PROJECT_URL).toMatchObject({value: 'https://w', variable_type: 'env_var'})
        expect(vars.BLUEPRINT_TOKEN_VAR).toMatchObject({value: 'tok', variable_type: 'env_var', masked: false})
    })

    it('warns about, and drops, a non-string value', async () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
        const vars = byKey(await prepareVariables({workflow: 'deploy', ODD: {a: 1}}))
        expect(vars).not.toHaveProperty('ODD')
        expect(warn).toHaveBeenCalled()
        warn.mockRestore()
    })
})

describe('triggering pipelines', () => {
    it('triggers on the project\'s default branch', async () => {
        axios.post.mockResolvedValue({data: {id: 1}})
        await expect(triggerPipeline('/org/dash/-/pipelines', [{key: 'A'}])).resolves.toEqual({id: 1})
        expect(getOrFetchDefaultBranch).toHaveBeenCalledWith('org%2Fdash')
        expect(axios.post).toHaveBeenCalledWith('/org/dash/-/pipelines', {ref: 'main', variables_attributes: [{key: 'A'}]})
    })

    it('takes a ref, without looking up the default', async () => {
        axios.post.mockResolvedValue({data: {}})
        await triggerPipeline('/org/dash/-/pipelines', [], {ref: 'dev'})
        expect(axios.post.mock.calls[0][1].ref).toBe('dev')
        expect(getOrFetchDefaultBranch).not.toHaveBeenCalled()
    })

    it('sends the upstream of an incremental deployment as env vars', async () => {
        axios.post.mockResolvedValue({data: {}})
        await triggerIncrementalDeployment('/org/dash/-/pipelines', {
            variables: {DEPLOY_PATH: 'p'}, upstreamBranch: 'main', upstreamCommit: 'abc', upstreamPipeline: 9, upstreamProject: 'org/bp',
        })
        const vars = byKey(axios.post.mock.calls[0][1].variables_attributes)
        expect(Object.values(vars).every(v => v.variable_type == 'env_var')).toBe(true)
        expect(vars.UPSTREAM_REF.value).toBe('main')
        expect(vars.UPSTREAM_PIPELINE_ID.value).toBe('9')
        expect(vars.DEPLOY_PATH.value).toBe('p')
    })

    it('schedules an atomic deployment as the project bot', async () => {
        axios.get.mockResolvedValue({data: [{name: 'someone', id: 1}, {name: 'UNFURL_PROJECT_TOKEN', id: 42}]})
        axios.post.mockResolvedValue({data: {ok: true}})

        await expect(triggerAtomicDeployment('org/dash', {variables: [{key: 'A'}], dependencies: {x: 1}})).resolves.toEqual({ok: true})

        expect(axios.get).toHaveBeenCalledWith('/api/v4/projects/org%2Fdash/members')
        expect(axios.post).toHaveBeenCalledWith('/org/dash/-/deployments/new', {
            pipeline: {ref: 'main', variables_attributes: [{key: 'A'}]},
            deployment: {bot_id: 42, schedule: 'now', project_dependencies: {x: 1}},
        })
    })

    it('refuses an atomic deployment without the project bot', async () => {
        axios.get.mockResolvedValue({data: []})
        await expect(triggerAtomicDeployment('org/dash', {})).rejects.toThrow('Could not get bot ID')
    })
})

describe('jobs', () => {
    it('builds the jobs path from either project shape', () => {
        expect(getJobsPath({id: 5, projectId: 7})).toBe('/api/v4/projects/7/pipelines/5/jobs')
        expect(getJobsPath({id: 5, project: {id: 8}})).toBe('/api/v4/projects/8/pipelines/5/jobs')
    })

    it('looks up a pipeline\'s jobs', async () => {
        axios.get.mockResolvedValue({data: [{id: 1}]})
        await expect(lookupPipelineJobs({projectId: 7, pipelineId: 5})).resolves.toEqual([{id: 1}])
        expect(axios.get).toHaveBeenCalledWith('/api/v4/projects/7/pipelines/5/jobs')
    })

    describe('redirectToJobConsole', () => {
        const pipelineData = {id: 5, projectId: 7}

        it('visits the first job after the beforeRedirect hook', async () => {
            const beforeRedirect = jest.fn()
            axios.get.mockResolvedValue({data: [{web_url: '/org/dash/-/jobs/1'}]})

            await expect(redirectToJobConsole({pipelineData}, {beforeRedirect})).resolves.toBe(true)

            expect(beforeRedirect).toHaveBeenCalled()
            expect(visitUrl).toHaveBeenCalledWith('/org/dash/-/jobs/1')
        })

        it('opens it in a new tab when asked', async () => {
            const open = jest.spyOn(window, 'open').mockImplementation(() => null)
            axios.get.mockResolvedValue({data: [{web_url: '/org/dash/-/jobs/1'}]})

            await redirectToJobConsole({pipelineData}, {newTab: true})

            expect(open).toHaveBeenCalledWith('/org/dash/-/jobs/1', '_blank')
            expect(visitUrl).not.toHaveBeenCalled()
            open.mockRestore()
        })

        it('does not redirect when the jobs cannot be read', async () => {
            axios.get.mockResolvedValue({data: null})
            await expect(redirectToJobConsole({pipelineData})).resolves.toBe(false)
        })

        // a pipeline whose jobs have not been created yet
        it('does not redirect when there is no job to go to', async () => {
            axios.get.mockResolvedValue({data: []})
            await expect(redirectToJobConsole({pipelineData})).resolves.toBe(false)
            expect(visitUrl).not.toHaveBeenCalled()
        })
    })
})
