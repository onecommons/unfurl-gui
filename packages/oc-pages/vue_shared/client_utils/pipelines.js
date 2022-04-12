import axios from '~/lib/utils/axios_utils'
import { redirectTo } from '~/lib/utils/url_utility';

function toGlVariablesAttributes(variables) {
    const result = []
    Object.entries(variables).forEach(([key, secret_value]) => {
        if(typeof secret_value != 'string') {
            if(secret_value) {
                console.warn({key, secret_value}, 'expected a string for secret_value')
            }
            return
        }
        result.push({
            key,
            secret_value,
            variable_type: 'env_var'
        })
    })

    return result
}

export async function triggerPipeline(pipelinesPath, variables_attributes, options) {
    // TODO implement followRedirect
    const defaults = {followRedirect: false, ref: 'main'}
    const {ref, followRedirect} = {...options, ...defaults}

    const {data} = await axios.post(pipelinesPath, {ref, variables_attributes})
    return data
}

export function prepareVariables({workflow, projectUrl, environmentName, deployPath, deploymentName, deploymentBlueprint, mockDeploy}) {
    return toGlVariablesAttributes({
        WORKFLOW: workflow,
        DEPLOY_ENVIRONMENT: environmentName,
        BLUEPRINT_PROJECT_URL: projectUrl,
        DEPLOY_PATH: deployPath,
        DEPLOYMENT: deploymentName,
        DEPLOYMENT_BLUEPRINT: deploymentBlueprint,
        UNFURL_MOCK_DEPLOY: mockDeploy && 'true',
        UNFURL_LOGGING: mockDeploy && 'trace'
    })
}

export function deploy(pipelinesPath, parameters, options) {
    return triggerPipeline(
        pipelinesPath,
        prepareVariables({...parameters, workflow: 'deploy'}),
        options
    )
}

export function undeploy(pipelinesPath, parameters, options) {
    return triggerPipeline(
        pipelinesPath,
        prepareVariables({...parameters, workflow: 'undeploy'}),
        options
    )
}

export async function redirectToJobConsole({pipelineData}, options) {
    // #!if false

    const projectId = pipelineData.project.id
    const pipelineId = pipelineData.id
    const jobsPath = `/api/v4/projects/${projectId}/pipelines/${pipelineId}/jobs`
    const jobsData = (await axios.get(jobsPath))?.data
    if(Array.isArray(jobsData)) {
        const redirectTarget = jobsData[0]?.web_url || redirectTarget
        if(options?.newTab) {
            window.open(redirectTarget, '_blank')
        } else {
            if(typeof options?.beforeRedirect == 'function') options.beforeRedirect()
            return redirectTo(redirectTarget)
        }

    }
    return false
    // TODO add a flash here?

    // #!endif

}

export async function lookupPipelineJobs({projectId, pipelineId}) {
    const jobsPath = `/api/v4/projects/${projectId}/pipelines/${pipelineId}/jobs`
    return (await axios.get(jobsPath))?.data
}
