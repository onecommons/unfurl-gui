import axios from '~/lib/utils/axios_utils'
import { visitUrl } from '~/lib/utils/url_utility';
import { getOrFetchDefaultBranch } from './projects'

export interface VariableAttributes {
    key: string
    masked: boolean
    secret_value: string
    value: string
    variable_type: string
}

interface PipelineData {
    id: number
    projectId?: number
    project?: {id: number}
}

const MASK_VARIABLES = ['UNFURL_ACCESS_TOKEN']
function toGlVariablesAttributes(variables: Record<string, unknown>, variable_type='unencrypted_var') {
    const result: VariableAttributes[] = []
    Object.entries(variables).forEach(([key, _secret_value]) => {
        let secret_value = typeof _secret_value == 'number'? _secret_value.toString(): _secret_value
        if(typeof secret_value != 'string') {
            if(secret_value) {
                console.warn({key, secret_value}, 'expected a string for secret_value')
            }
            return
        }
        result.push({
            key,
            masked: MASK_VARIABLES.includes(key),
            // 15.11 permits only secret_value, 19.3 only value, and strong params
            // drops the unpermitted one silently -- so send both until the fork
            // upgrade lands and secret_value can go
            secret_value,
            value: secret_value,
            variable_type
        })
    })

    return result
}

export async function triggerPipeline(pipelinesPath: string, variables_attributes: VariableAttributes[], options?: {ref?: string}) {
    // pipelinesPath is root-relative: `/group/project/-/pipelines`
    const ref = options?.ref || await getOrFetchDefaultBranch(encodeURIComponent(pipelinesPath.split('/-/')[0].replace(/^\//, '')))

    const {data} = await axios.post(pipelinesPath, {ref, variables_attributes})
    return data
}


export async function triggerAtomicDeployment(projectPath: string, {ref, schedule='now', variables=[], dependencies={}}: {
    ref?: string
    schedule?: string
    variables?: VariableAttributes[]
    dependencies?: Record<string, unknown>
}) {
    const _ref = ref || await getOrFetchDefaultBranch(encodeURIComponent(projectPath))

    const members = (await axios.get(`/api/v4/projects/${encodeURIComponent(projectPath)}/members`))?.data || []
    const bot_id = members.find((m: {name: string, id: number}) => m.name == 'UNFURL_PROJECT_TOKEN')?.id

    if(!bot_id) throw new Error('Could not get bot ID of UNFURL_PROJECT_TOKEN for atomic deployment')

    return (await axios.post(
        `/${projectPath}/-/deployments/new`,
        {
            pipeline: {ref: _ref, variables_attributes: variables},
            deployment: {
                bot_id,
                schedule,
                project_dependencies: dependencies
            },
        }
    ))?.data
}

// this doens't need to be async if generateAccessToken is done upon first sign-in with the vault token, but I think it's a good contract to enforce
// it's possible we'll want to make async calls here in the future
export async function prepareVariables({
    workflow,
    projectUrl,
    environmentName,
    deployPath,
    deploymentName,
    deploymentBlueprint,
    writableBlueprintProjectUrl,
    blueprintToken,
    mockDeploy,
    upstreamCommit,
    upstreamBranch,
    upstreamProject,
    upstreamProjectPath,
    forceCheck,
    dryRun,
    ...extraVars
}: {
    workflow?: string
    projectUrl?: string
    environmentName?: string
    deployPath?: string
    deploymentName?: string
    deploymentBlueprint?: string
    writableBlueprintProjectUrl?: string
    blueprintToken?: string
    mockDeploy?: boolean
    upstreamCommit?: string
    upstreamBranch?: string
    upstreamProject?: string | number
    upstreamProjectPath?: string
    forceCheck?: boolean
    dryRun?: boolean
    [key: string]: unknown
}) {

    const UNFURL_TRACE = !!Object.keys(sessionStorage).find(key => key == 'unfurl-trace') // TODO propagate this from misc store
    const DEPLOY_IMAGE = sessionStorage['deploy-image']
    const UNFURL_VALIDATION_MODE = sessionStorage['unfurl-validation-mode']

    const workflowArgs: string[] = []

    if(forceCheck) {
        workflowArgs.push('--check')
    }

    if(dryRun) {
        workflowArgs.push('--dryrun')
    }

    // word-split onto the unfurl command line by the CI template
    const EXTRA_WORKFLOW_ARGS = workflowArgs.join(' ') || false

    //const UNFURL_ACCESS_TOKEN = await generateAccessToken('UNFURL_ACCESS_TOKEN') currently saving this in the environment

    // non-string falsey values will be filtered out
    return toGlVariablesAttributes({
        WORKFLOW: workflow,
        DEPLOY_ENVIRONMENT: environmentName,
        BLUEPRINT_PROJECT_URL: projectUrl,
        DEPLOY_PATH: deployPath,
        DEPLOYMENT: deploymentName,
        DEPLOYMENT_BLUEPRINT: deploymentBlueprint,
        UPSTREAM_COMMIT: upstreamCommit ?? null,
        UPSTREAM_PROJECT: upstreamProject ?? null,
        UPSTREAM_PROJECT_PATH: upstreamProjectPath ?? null,
        UPSTREAM_REF: upstreamBranch ?? null,
        UPSTREAM_BRANCH: upstreamBranch ?? null,
        UNFURL_MOCK_DEPLOY: mockDeploy && 'true',
        UNFURL_LOGGING: (mockDeploy || UNFURL_TRACE) && 'trace',
        UNFURL_VALIDATION_MODE,
        DEPLOY_IMAGE,
        USE_DEPLOYMENT_BLUEPRINT: deploymentBlueprint? null : "--use-deployment-blueprint ''",
        EXTRA_WORKFLOW_ARGS,
        ...extraVars
    }).concat(
        toGlVariablesAttributes({
            WRITABLE_BLUEPRINT_PROJECT_URL: writableBlueprintProjectUrl ?? null,
            BLUEPRINT_TOKEN_VAR: blueprintToken ?? null,
        }, 'env_var')
    )
}

export async function triggerIncrementalDeployment(pipelinesPath: string, {variables, upstreamBranch, upstreamCommit, upstreamPipeline, upstreamProject}: {
    variables?: Record<string, unknown>
    upstreamBranch?: string
    upstreamCommit?: string
    upstreamPipeline?: number
    upstreamProject?: string | number
}) {
    const variablesDict = {
        ...variables,
        UPSTREAM_BRANCH: upstreamBranch, UPSTREAM_REF: upstreamBranch,
        UPSTREAM_COMMIT: upstreamCommit,
        UPSTREAM_PIPELINE_ID: upstreamPipeline, UPSTREAM_PIPELINE: upstreamPipeline,
        UPSTREAM_PROJECT: upstreamProject
    }

    return triggerPipeline(pipelinesPath, toGlVariablesAttributes(variablesDict, 'env_var'))
}

export function getJobsPath(pipelineData: PipelineData) {
    const projectId = pipelineData.projectId || pipelineData.project!.id
    const pipelineId = pipelineData.id
    return `/api/v4/projects/${projectId}/pipelines/${pipelineId}/jobs`
}

export async function getJobsData(pipelineData: PipelineData) {
    const jobsPath = getJobsPath(pipelineData)
    const jobsData = (await axios.get(jobsPath))?.data
    return jobsData
}

export async function redirectToJobConsole({pipelineData}: {pipelineData: PipelineData}, options?: {newTab?: boolean, beforeRedirect?: () => void}): Promise<boolean | undefined> {
    // #!if !standalone

    const jobsData = await getJobsData(pipelineData)
    // a pipeline whose jobs have not been created yet has nowhere to go
    const redirectTarget: string | undefined = Array.isArray(jobsData) ? jobsData[0]?.web_url : undefined
    if(redirectTarget) {
        if(options?.newTab) {
            window.open(redirectTarget, '_blank')
        } else {
            if(typeof options?.beforeRedirect == 'function') options.beforeRedirect()
            visitUrl(redirectTarget)
        }
        return true
    }
    return false
    // TODO add a flash here?

    // #!endif

}

export async function lookupPipelineJobs({projectId, pipelineId}: {projectId: number, pipelineId: number}) {
    const jobsPath = `/api/v4/projects/${projectId}/pipelines/${pipelineId}/jobs`
    return (await axios.get(jobsPath))?.data
}
