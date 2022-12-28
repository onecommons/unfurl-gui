import axios from '~/lib/utils/axios_utils'
import {postFormDataWithEntries} from './forms'
import {patchEnv, fetchEnvironmentVariables, deleteEnvironmentVariables} from './envvars'
import {setLastCommit, fetchLastCommit} from 'oc_vue_shared/client_utils/projects'
import {fetchUserAccessToken} from './user'

export async function fetchGitlabEnvironments(projectPath, environmentName) {
    let result = []
    // #!if false

    const {data} = await axios.get(`/${projectPath}/-/environments.json`)
    console.log(data)
    result = data?.environments || result

    // #!endif
    return result
} 

export async function lookupEnvironmentId(projectPath, environmentName) {
    let result = 0

    const environments = await fetchGitlabEnvironments(projectPath, environmentName)
    result = environments.find(env => env.name == environmentName)?.id ?? -1

    return result
}

// use prefix='' to use no prefix
export async function shareEnvironmentVariables(projectPath, sourceEnvironment, targetEnvironment, variables, prefix=null) {
    let _prefix = prefix
    if(_prefix === null) {
        _prefix = `_${Date.now().toString(36)}`
    }


    const patch = {}
    const transferredVariables = []
    for(const environmentVariable of await fetchEnvironmentVariables(projectPath)) {
        if(environmentVariable.environment_scope != sourceEnvironment) continue
        if(!variables.includes(environmentVariable.key)) continue
        delete environmentVariable.id
        environmentVariable.environment_scope = targetEnvironment
        transferredVariables.push(environmentVariable.key)
        environmentVariable.key = _prefix? `${_prefix}__${environmentVariable.key}`: environmentVariable.key

        patch[environmentVariable.key] = environmentVariable
    }

    return {
        prefix: _prefix,
        transferredVariables,
        patch: await patchEnv(patch, targetEnvironment, projectPath)
    }
}

export async function deleteEnvironmentByName(projectPath, environmentName) {
    const environments = await fetchGitlabEnvironments(projectPath, environmentName)
    const env = environments.find(env => env.name == environmentName)
    console.log({env, projectPath, environmentName})

    const stop_path = env?.stop_path
    const delete_path = env?.delete_path

    await deleteEnvironmentVariables(environmentName, projectPath)
    if(stop_path && delete_path) {
        await axios.post(stop_path)
        await axios.delete(delete_path)
        console.warn('TODO check delete status')
        return true
    }
    return false
}
export async function deleteEnvironment(projectPath, projectId, environmentName, environmentId) {
    console.warn('TODO Use deleteEnvironmentByName instead')
    // #!if false
    const {variables} = (await axios.get(`/${projectPath}/-/variables`)).data
    const patchVariables = []

    await deleteEnvironmentVariables(environmentName, projectPath)
    if(patchVariables.length) {
        await axios.patch(`/${projectPath}/-/variables`, {variables_attributes: patchVariables})
    }

    await axios.post(`/${projectPath}/-/environments/${environmentId}/stop`)
    await axios.delete(`/api/v4/projects/${projectId}/environments/${environmentId}`)
    // #!endif
}

// NOTE try to keep this in sync with commitPreparedMutations
// NOTE can be invoked from cluster creation views - unfurlServicesUrl fallback to /services/unfurl-server 
export async function initUnfurlEnvironment(projectPath, environment, credentials={}, unfurlServicesUrl='/services/unfurl-server') {
    const branch = 'main' // TODO don't hardcode main

    const patch = [{
        ...environment,
        connections: {primary_provider: environment.primary_provider},
        __typename: 'DeploymentEnvironment'
    }]

    const username = credentials.username || window.gon.current_username
    const password = credentials.password || await fetchUserAccessToken()

    const variables = {
        commit_msg: `Create environment '${environment.name}' in ${projectPath}`,
        username,
        password,
        patch,
        branch,
        path: 'environments.json'
    }

    const {commit} = (await axios.post(`${unfurlServicesUrl}/update_environment?auth_project=${encodeURIComponent(projectPath)}`, variables))?.data
    setLastCommit(encodeURIComponent(projectPath), branch, commit)
}

export async function postGitlabEnvironmentForm() {
    const environmentFormEntries = JSON.parse(sessionStorage['environmentFormEntries'])
    const environmentFormAction = sessionStorage['environmentFormAction']
    try {
        const result = await postFormDataWithEntries(environmentFormAction, environmentFormEntries)
        if(result.code >= 400) throw new Error()
        return result
    } catch(e) {
        throw new Error(`Failed to create dashboard environment: ${e.message}`)
    }
}

export function connectionsToArray(environment) {
    if(Array.isArray(environment)) return environment
    if(environment.connections) {
        for(const key in environment.connections) { 
            if(isNaN(parseInt(key))) { //// not sure how much of this is still needed
                delete environment.connections[key]
            }
        }
        environment.connections = Object.values(environment.connections)
    }
    if(environment.instances) {
        for(const key in environment.instances) { 
            if(isNaN(parseInt(key))) { //// not sure how much of this is still needed
                delete environment.instances[key]
            }
        }
        environment.instances = Object.values(environment.instances)
    }

    return environment
}

export async function fetchEnvironments({fullPath, token, credentials, unfurlServicesUrl, includeDeployments}) {
    // TODO don't hardcode main
    const branch = 'main'

    const username = credentials.username || 'UNFURL_PROJECT_TOKEN'
    const password = credentials.password || token

    const latestCommit = await fetchLastCommit(encodeURIComponent(fullPath), branch)
    // TODO get the branch passed into fetch environments
    // TODO use ?include_deployments=true
    let environmentUrl = `${unfurlServicesUrl}/export?format=environments`
    environmentUrl += `&username=${username}`
    environmentUrl += `&password=${password}`
    environmentUrl += `&auth_project=${encodeURIComponent(fullPath)}`
    environmentUrl += `&branch=${branch}`
    environmentUrl += `&latest_commit=${latestCommit}`
    if(includeDeployments) {
        environmentUrl += `&include_all_deployments=1`
    }

    const {data} = await axios.get(environmentUrl)

    const environments = Object.values(data.DeploymentEnvironment)
        .filter(env => env.name != 'defaults')
        .map(env => {env._dashboard = fullPath; return env})

    for(const env of environments) { env._dashboard = fullPath }

    const deploymentPaths = Object.values(data.DeploymentPath)

    const  defaults = data.DeploymentEnvironment.defaults

    const result = {environments, deploymentPaths, fullPath, defaults, ResourceType: data.ResourceType}


    if(includeDeployments) {
        const deployments = data.deployments

        deployments.forEach(deployment => {
            console.log(deployment.name)
            const deploymentName = Object.keys(deployment.Deployment)[0]

            const environment = deploymentPaths.find(dp => dp.name.endsWith(`/${deploymentName}`)).environment
            deployment._environment = environment
        })
        result.deployments = deployments
    }

    return result
}
