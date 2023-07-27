import axios from '~/lib/utils/axios_utils'
import {postFormDataWithEntries} from './forms'
import {patchEnv, tryFetchEnvironmentVariables, deleteEnvironmentVariables} from './envvars'
import { unfurlServerUpdate } from './unfurl-server'
import gql from 'graphql-tag'
import graphqlClient from 'oc/graphql-shim'
import _ from 'lodash'
import { lookupCloudProviderAlias } from '../util.mjs'
import {unfurlServerExport} from './unfurl-server'
import {localNormalize} from '../lib/normalize'

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
export async function shareEnvironmentVariables(projectPath, sourceEnvironment, targetEnvironment, variables, prefix=null, substitutions=[]) {
    let _prefix = prefix
    if(_prefix === null) {
        _prefix = `_${Date.now().toString(36)}`
    }


    const patch = {}
    const transferredVariables = []
    for(const environmentVariable of await tryFetchEnvironmentVariables(projectPath)) {
        if(environmentVariable.environment_scope != sourceEnvironment) continue
        if(!variables.includes(environmentVariable.key)) continue
        delete environmentVariable.id
        environmentVariable.environment_scope = targetEnvironment
        transferredVariables.push(environmentVariable.key)
        environmentVariable.key = _prefix? `${_prefix}__${environmentVariable.key}`: environmentVariable.key

        substitutions.forEach(([match, replacement]) => {
            environmentVariable.key = environmentVariable.key.replace(match, replacement)
        })

        patch[environmentVariable.key] = environmentVariable
    }

    return {
        prefix: _prefix,
        transferredVariables,
        patch: await patchEnv(patch, targetEnvironment, projectPath, 0)
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
export async function initUnfurlEnvironment(projectPath, environment, variables={}) {
    const branch = 'main' // TODO don't hardcode main

    const patch = [{
        ...environment,
        connections: {primary_provider: environment.primary_provider},
        __typename: 'DeploymentEnvironment'
    }]

    const method = variables.deployment_path? 'create_provider': 'update_environment'

    await unfurlServerUpdate({
        commitMessage: `Create environment '${environment.name}' in ${projectPath}`,
        projectPath,
        method: method,
        patch,
        branch,
        path: 'unfurl.yaml',
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

export async function fetchEnvironments({fullPath, includeDeployments, branch}) {
    const projectPath = fullPath
    const format = 'environments'
    const errors = []

    // TODO get the branch passed into fetch environments
    // TODO use ?include_deployments=true

    let data

    try {
        data = await unfurlServerExport({
            format,
            projectPath,
            includeDeployments,
            branch,
        })
    } catch(e) {
        const responseData = e.response?.data
        errors.push({
            message: `@fetchEnvironments: An error occurred during an export request (${e.message})`,
            context: {
                error: e.message,
                format,
                projectPath,
                includeDeployments,
                branch,
                ...(typeof responseData == 'object'? responseData: null)
            },
            severity: 'critical'
        })
        return {errors}
    }

    const environments = Object.values(data.DeploymentEnvironment)
        .filter(env => env.name != 'defaults')
        .map(env => {env._dashboard = fullPath; return env})

    for(const env of environments) { 
        env._dashboard = fullPath
        Object.entries(env.instances).forEach(([key, value]) => {
            const title = value.title || value.metadata?.title || key
            env.instances[key] = {...value, title, name: key}
        })
    }

    const deploymentPaths = Object.values(data.DeploymentPath)

    const defaults = data.DeploymentEnvironment.defaults

    Object.values(data.ResourceType).forEach(resourceType => {
        localNormalize(resourceType, 'ResourceType', null)
    })

    const result = {environments, deploymentPaths, fullPath, defaults, ResourceType: data.ResourceType, errors}

    if(includeDeployments) {
        const deploymentErrors = []

        // that filter is expected to be obsolete
        const deployments = data.deployments.filter(dep => !dep.ApplicationBlueprint || !Object.keys(dep.ApplicationBlueprint).includes('generic-cloud-provider-implementations'))
        // temporary error before removal so this goes loud
        if(deployments.length != data.deployments.length) {
            result.errors.push({
                message: 'Assertion failed: An obsolete filter removed a deployment',
                context: {
                    filtered: _.cloneDeep(deployments),
                    unfiltered: _.cloneDeep(data.deployments)
                },
                severity: 'minor'
            })
        }

        deployments.forEach(deployment => {
            if(deployment.error) {
                deploymentErrors.push({
                    detail: `Error occured while exporting a deployment`,
                    deployment: deployment.deployment,
                    url: deployment.deployment.replace(/^(..\/)*/, window.location.origin + '/'),
                    error: deployment.error
                })
                return
            }
            try {
                const [deploymentName, deploymentObject] = Object.entries(deployment.Deployment)[0]

                const environment = deploymentPaths.find(dp => dp.name.endsWith(`/${deploymentName}`)).environment
                deployment._environment = environment

                if(deployment.ResourceType) {
                    Object.values(deployment.ResourceType).forEach(rt => localNormalize(rt, 'ResourceType', deployment))
                }

                localNormalize(deploymentObject, 'Deployment', deployment)
            } catch(e) {
                deploymentErrors.push({
                    deployment: Object.values(deployment.Deployment)[0].title,
                    detail: 'Unexpected shape for deployment',
                    error: e.message,
                })
            }
        })
        if(deploymentErrors.length > 0) {
            let message = ''
            if (deploymentErrors.length == 1) {
                message = 'An error occurred while fetching deployments.'
            } else {
                message = `${deploymentErrors.length} errors occurred while fetching deployments.`
            }

            message += ` Unable to display ${deploymentErrors.map(de => de.deployment.split('/').pop()).join(', ')} due to errors.`
            errors.push({
                message,
                context: deploymentErrors,
                severity: 'major'
            })
        }
        result.deployments = deployments
    }

    return result
}

let _gitlabProjectEnvironments = {}
export async function gitlabProjectEnvironments(projectPath) {
    const env = _gitlabProjectEnvironments[projectPath]
    if(env) return env
    return _gitlabProjectEnvironments[projectPath] = (() => axios.get(`/api/v4/projects/${encodeURIComponent(projectPath)}/environments`).then(res => res.data))()
}

export async function gitlabEnvironmentId(projectPath, environmentName) {
    const environments = await gitlabProjectEnvironments(projectPath)
    return environments.find(env => env.name == environmentName)?.id
}

function encodeProviderString(providers) {
    return `http://localhost/${encodeURIComponent(providers.join(','))}`
}

function decodeProviderString(s) {
    return s && decodeURIComponent((new URL(s)).pathname.slice(1)).split(',')
}

export async function declareAvailableProviders(projectPath, environmentName, providerTypes) {
    const providers = _.uniqWith(providerTypes.map(lookupCloudProviderAlias), _.isEqual)

    if(providers.some(p => !p)) {
        throw new Error(`@declareAvailableProviders: unknown provider types among ${JSON.stringify(providerTypes)}`)
    }

    const environmentId = await gitlabEnvironmentId(projectPath, environmentName)
    if (!_.isNumber(environmentId)) {
        throw new Error(`@declareAvailableProviders: could not lookup environment ID for ${environmentName} in ${projectPath}`)
    }

    axios.put(
        `/api/v4/projects/${encodeURIComponent(projectPath)}/environments/${environmentId}`,
        {
            external_url: encodeProviderString(providers)
        }
    )
}

class DashboardProviders {
    constructor(data) {
        this.project = data.project
    }

    get environments() {
        return this.project.environments.nodes
    }

    get fullPath() {
        return this.project.fullPath
    }

    get accessLevel() {
        return this.project.projectMembers.nodes[0].accessLevel.integerValue
    }

    get providersByEnvironment() {
        const result = {}
        this.environments.forEach(env => {
            result[env.name] = decodeProviderString(env.externalUrl)
        })
        return result
    }

    primaryProviderFor(environmentName) {
        try {
            return this.providersByEnvironment[environmentName][0]
        } catch(e) {
            return null
        }
    }
}

export async function fetchAvailableProviderDashboards(minAccessLevel=0) {
    // FIXME find a better way of getting username
    const username = window.gon.current_username

    const query = gql`
        query fetchAvailableProviderDashboards ($username: String){
            currentUser {
                projectMemberships {
                    nodes {
                        project {
                            fullPath
                            projectMembers (search: $username) {
                                nodes {
                                    user {
                                        name
                                    }
                                    accessLevel {
                                        integerValue
                                    }
                                }
                            }
                            environments {
                                nodes
                                {
                                    name
                                    externalUrl
                                }
                            }
                        }
                    }
                }
            }
        }
    `

    const response = await graphqlClient.defaultClient.query({
        query,
        variables: {username}
    })

    const {data, errors} = response
    const projects = data?.currentUser?.projectMemberships?.nodes

    if(!Array.isArray(projects)) {
        console.error(data)
        throw new Error(`@fetchAvailableProviderDashboards: could not read list of providers`)
    }

    return projects.map(p => new DashboardProviders(p)).filter(p => p.accessLevel >= minAccessLevel)
}

export async function fetchDashboardProviders(projectPath) {
    const query = gql`
        query fetchDashboardProviders ($projectPath: ID!) {
          project(fullPath: $projectPath) {
            fullPath
            environments {
              nodes {
                name
                externalUrl
              }
            }
          }
        }
    `
     const response = await graphqlClient.defaultClient.query({
        query,
        variables: {projectPath}
    })

    const {data, errors} = response

    if(errors) { throw new Error('@fetchDashboardProviders: ' + JSON.stringify(errors, null, 2)) }

    return data?.project ? new DashboardProviders({project: data.project}): null
}
