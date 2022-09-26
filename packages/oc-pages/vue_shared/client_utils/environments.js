import axios from '~/lib/utils/axios_utils'
import gql from 'graphql-tag'
import {cloneDeep} from 'lodash'
import graphqlClient from 'oc_pages/project_overview/graphql';
import {UpdateDeploymentObject} from 'oc_pages/project_overview/graphql/mutations/update_deployment_object.graphql'
import {postFormDataWithEntries} from './forms'
import {patchEnv, fetchEnvironmentVariables, deleteEnvironmentVariables} from './envvars.js'

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
    for(const environmentVariable of await fetchEnvironmentVariables(projectPath)) {
        if(environmentVariable.environment_scope != sourceEnvironment) continue
        if(!variables.includes(environmentVariable.key)) continue
        delete environmentVariable.id
        environmentVariable.environment_scope = targetEnvironment
        environmentVariable.key = _prefix? `${_prefix}__${environmentVariable.key}`: environmentVariable.key

        patch[environmentVariable.key] = environmentVariable
    }

    return {
        prefix: _prefix,
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

export async function initUnfurlEnvironment(projectPath, environment) {
    const variables = {
        patch: [{
            ...environment,
            connections: {primary_provider: environment.primary_provider},
            __typename: 'DeploymentEnvironment'
        }],
        fullPath: projectPath,
        path: 'environments.json'
    }
    return await graphqlClient.clients.defaultClient.mutate({
        mutation: UpdateDeploymentObject,
        variables
    })
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

export async function fetchEnvironments({fullPath, fetchPolicy}) {
    const query = gql`
        query getProjectEnvironments($fullPath: ID!) {
            project(fullPath: $fullPath) {
                environments {
                    nodes {
                        deploymentEnvironment @client {
                            connections
                            instances
                            primary_provider
                        }
                        ResourceType @client
                        deployments
                        clientPayload
                        name
                        state
                    }
                }
            }
        }`

    let environments
    let deployments = []
    let deploymentPaths = []
    let resourceTypeDictionary

    const {data, errors} = await graphqlClient.clients.defaultClient.query({
        query,
        fetchPolicy,
        errorPolicy: 'all',
        variables: {fullPath}
    })
    if(errors) {throw new Error(errors)}

    // cloning in the resolver can't be relied on unless we use a different fetchPolicy
    // there's probably a better way of getting vuex to stop watching environments when we call this action
    // alternatively we could check if it's cached
    environments = cloneDeep(data.project.environments).nodes.map(environment => {
        Object.assign(environment, environment.deploymentEnvironment)
        // alternative to adding a graphql type?
        environment.external = environment.clientPayload.DeploymentEnvironment.external || {}
        deploymentPaths = deploymentPaths.concat(Object.values(environment.clientPayload.DeploymentPath || {}))
        //commit('setResourceTypeDictionary', {environment, dict: environment.ResourceType})
        //commit('setDeploymentPaths', deploymentPaths)
        //delete environment.ResourceType
        for(const deployment of environment.deployments) {
            if(!deployment._environment) deployment._environment = environment.name
            for(const dep of Object.values(deployment.Deployment || {})) {
                dep.__typename = 'Deployment'
            }
            deployments.push(deployment)
        }
        delete environment.deploymentEnvironment
        delete environment.clientPayload
        environment._dashboard = fullPath
        environment.__typename = 'DeploymentEnvironment' // just documenting this to avoid confusion with __typename Environment

        connectionsToArray(environment)

        return environment
    })

    return {environments, deployments, deploymentPaths, fullPath}

}
