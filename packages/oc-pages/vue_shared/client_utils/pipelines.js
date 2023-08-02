import axios from '~/lib/utils/axios_utils'
import { redirectTo } from '~/lib/utils/url_utility';

const MASK_VARIABLES = ['UNFURL_ACCESS_TOKEN']
function toGlVariablesAttributes(variables, variable_type='unencrypted_var') {
    const result = []
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
            secret_value,
            variable_type
        })
    })

    return result
}

export async function triggerPipeline(pipelinesPath, variables_attributes, options) {
    // TODO implement followRedirect
    const defaults = {followRedirect: false, ref: 'main'}
    const {ref, followRedirect} = {...defaults, ...options}

    const {data} = await axios.post(pipelinesPath, {ref, variables_attributes})
    return data
}


export async function triggerAtomicDeployment(projectPath, {ref='main', schedule='now', variables=[], dependencies={}}) {
    const members = (await axios.get(`/api/v4/projects/${encodeURIComponent(projectPath)}/members`))?.data || []
    const bot_id = members.find(m => m.name == 'UNFURL_PROJECT_TOKEN')?.id

    if(!bot_id) throw new Error('Could not get bot ID of UNFURL_PROJECT_TOKEN for atomic deployment')

    return (await axios.post(
        `/${projectPath}/-/deployments/new`,
        {
            pipeline: {ref, variables_attributes: variables},
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
    ...extraVars
}) {

    const UNFURL_TRACE = !!Object.keys(sessionStorage).find(key => key == 'unfurl-trace') // TODO propagate this from misc store
    const DEPLOY_IMAGE = sessionStorage['deploy-image']
    const UNFURL_VALIDATION_MODE = sessionStorage['unfurl-validation-mode']

    let EXTRA_WORKFLOW_ARGS = []

    if(forceCheck) {
        EXTRA_WORKFLOW_ARGS.push('--check')
    }

    EXTRA_WORKFLOW_ARGS = EXTRA_WORKFLOW_ARGS.join('') || false

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

export async function triggerIncrementalDeployment(pipelinesPath, {variables, upstreamBranch, upstreamCommit, upstreamPipeline, upstreamProject}) {
    const variablesDict = {
        ...variables,
        UPSTREAM_BRANCH: upstreamBranch, UPSTREAM_REF: upstreamBranch,
        UPSTREAM_COMMIT: upstreamCommit,
        UPSTREAM_PIPELINE_ID: upstreamPipeline, UPSTREAM_PIPELINE: upstreamPipeline,
        UPSTREAM_PROJECT: upstreamProject
    }

    return triggerPipeline(pipelinesPath, toGlVariablesAttributes(variablesDict, 'env_var'))
}

export async function deploy(pipelinesPath, parameters, options) {
    return triggerPipeline(
        pipelinesPath,
        await prepareVariables({...parameters, workflow: 'deploy'}),
        options
    )
}

export async function undeploy(pipelinesPath, parameters, options) {
    return triggerPipeline(
        pipelinesPath,
        await prepareVariables({...parameters, workflow: 'undeploy'}),
        options
    )
}

export function getJobsPath(pipelineData) {
    const projectId = pipelineData.projectId || pipelineData.project.id
    const pipelineId = pipelineData.id
    return `/api/v4/projects/${projectId}/pipelines/${pipelineId}/jobs`
}

export async function getJobsData(pipelineData) {
    const jobsPath = getJobsPath(pipelineData)
    const jobsData = (await axios.get(jobsPath))?.data
    return jobsData
}

export async function redirectToJobConsole({pipelineData}, options) {
    // #!if false

    const jobsData = await getJobsData(pipelineData)
    if(Array.isArray(jobsData)) {
        const redirectTarget = jobsData[0]?.web_url || redirectTarget
        if(options?.newTab) {
            window.open(redirectTarget, '_blank')
        } else {
            if(typeof options?.beforeRedirect == 'function') options.beforeRedirect()
            redirectTo(redirectTarget)
        }
        return true
    }
    return false
    // TODO add a flash here?

    // #!endif

}

export async function lookupPipelineJobs({projectId, pipelineId}) {
    const jobsPath = `/api/v4/projects/${projectId}/pipelines/${pipelineId}/jobs`
    return (await axios.get(jobsPath))?.data
}
