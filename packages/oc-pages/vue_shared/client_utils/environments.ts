import axios from '~/lib/utils/axios_utils'
import {postFormDataWithEntries} from './forms'
import {patchEnv, tryFetchEnvironmentVariables, deleteEnvironmentVariables} from './envvars'
import { unfurlServerUpdate, unfurlServerExport, fetchTypeRepositories } from './unfurl-server'
import gql from 'graphql-tag'
import graphqlClient from 'oc/graphql_shim'
import _ from 'lodash'
import { lookupCloudProviderAlias } from '../util'
import {localNormalize} from '../lib/normalize'
import { getOrFetchCurrentBranch, fetchLastCommit } from './projects'

// A GitLab environment, as /-/environments.json and the environments API list it.
interface GitlabEnvironment {
    id: number
    name: string
    stop_path?: string
    delete_path?: string
}

interface Template {
    name?: string
    type: string
    _sourceinfo?: {file: string, url: string, repository?: string}
}

// An unfurl DeploymentEnvironment, as created here and exported by the server.
export interface DeploymentEnvironment {
    name: string
    primary_provider?: Template
    instances?: Record<string, any>
    connections?: Record<string, any> | any[]
    error?: string
    _dashboard?: string
    [key: string]: any
}

export interface LoadError {
    message: string
    context: unknown
    severity: 'critical' | 'major' | 'minor'
}

interface DeploymentError {
    deployment: string
    detail: string
    url?: string
    error: unknown
}

interface EnvironmentVariable {
    id?: number
    key: string
    value: string
    environment_scope: string
    [key: string]: unknown
}

// One project as the provider-dashboard queries return it.
interface ProviderProject {
    fullPath: string
    projectMembers?: {nodes: {accessLevel: {integerValue: number}}[]}
    environments: {nodes: {name: string, externalUrl: string | null}[]}
}

export async function fetchGitlabEnvironments(projectPath: string, environmentName?: string): Promise<GitlabEnvironment[]> {
    let result: GitlabEnvironment[] = []
    // #!if !standalone

    const {data} = await axios.get(`/${projectPath}/-/environments.json`)
    result = data?.environments || result

    // #!endif
    return result
}

// ?name= is an exact match across every state. /-/environments.json cannot
// answer this: it serves ACTIVE_STATES only and paginates, so an environment
// that is already stopped, or simply far enough down the list, is missing.
//
// gitlabEnvironmentId below answers the same question off a module-level cache
// and without the filter, so it is subject to both that staleness and the page
// size. Deleting cannot use it; the two should probably converge on this one.
export async function lookupEnvironmentId(projectPath: string, environmentName: string): Promise<number> {
    let result = -1
    // #!if !standalone

    const {data} = await axios.get(
        `/api/v4/projects/${encodeURIComponent(projectPath)}/environments`,
        {params: {name: environmentName}}
    )
    result = data?.find((env: GitlabEnvironment) => env.name == environmentName)?.id ?? -1

    // #!endif
    return result
}

// use prefix='' to use no prefix
export async function shareEnvironmentVariables(projectPath: string, sourceEnvironment: string, targetEnvironment: string, variables: string[], prefix: string | null = null, substitutions: [string | RegExp, string][] = []) {
    let _prefix = prefix
    if(_prefix === null) {
        _prefix = `_${Date.now().toString(36)}`
    }


    const patch: Record<string, EnvironmentVariable> = {}
    const transferredVariables: string[] = []
    for(const environmentVariable of await tryFetchEnvironmentVariables(projectPath) as EnvironmentVariable[]) {
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

export async function deleteEnvironmentByName(projectPath: string, environmentName: string) {
    const environments = await fetchGitlabEnvironments(projectPath, environmentName)
    const env = environments.find(env => env.name == environmentName)

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
// The environment to delete is named, never passed by id: gon.environmentId is
// whichever environment the server rendered, and the dashboard routes between
// environments without reloading. Landing on one and deleting another stopped
// and deleted the environment still recorded in the dataset -- and landing
// anywhere the dataset omits it (the index, the home page) sent `undefined`.
export async function deleteEnvironment(projectPath: string, environmentName: string) {
    // #!if !standalone
    // Resolved before anything is destroyed, so a name that matches nothing
    // leaves the environment's variables where they are.
    const environmentId = await lookupEnvironmentId(projectPath, environmentName)
    if(environmentId <= 0) {
        throw new Error(`Could not find an environment named ${environmentName} to delete.`)
    }

    await deleteEnvironmentVariables(environmentName, projectPath)

    // stop stays on the html route it has always used -- the 01_environments
    // specs exercise it and the api equivalent is untried here. Only the id
    // being passed to it has changed.
    await axios.post(`/${projectPath}/-/environments/${environmentId}/stop`)
    await axios.delete(`/api/v4/projects/${encodeURIComponent(projectPath)}/environments/${environmentId}`)
    // #!endif
}

// NOTE try to keep this in sync with commitPreparedMutations
export async function initUnfurlEnvironment(projectPath: string, environment: DeploymentEnvironment, variables: {deployment_path?: string, [key: string]: unknown} = {}) {
    const branch = await getOrFetchCurrentBranch(encodeURIComponent(projectPath))

    const requiredTemplates: Template[] = [...Object.values(environment.instances || {}), environment.primary_provider].filter(tmpl => !!tmpl)

    const sourceInfos: Record<string, NonNullable<Template['_sourceinfo']>> = {
        'ConnectsTo.DigitalOceanEnvironment': {
            "file": "digitalocean/compute.yaml",
            "url": "https://unfurl.cloud/onecommons/std.git"
        },
        'ConnectsTo.AzureEnvironment': {
            "file": "azure/compute.yaml",
            "url": "https://unfurl.cloud/onecommons/std.git"
        },
        'KubernetesIngressController': {
            "file": "k8s.py",
            "url": "https://unfurl.cloud/onecommons/std.git"
        },
        "unfurl.relationships.ConnectsTo.K8sCluster": {
            "file": "tosca_plugins/k8s.yaml",
            "repository": "unfurl",
            "url": "github.com/onecommons/unfurl"
        }
    }

    // automatically add _sourceinfo for imports when necessary
    requiredTemplates.forEach(tmpl => {
        const [_, sourceInfo] = Object.entries(sourceInfos).find(([name]) => name == tmpl.type || name == tmpl.type.split('@').shift()) || []
        if(sourceInfo) {
            tmpl._sourceinfo = sourceInfo
        }
    })

    const created = {
        ...environment,
        instances: environment.instances || {},
        // an absent primary_provider must not become a connection of undefined --
        // the environment page maps over Object.values(connections)
        connections: environment.primary_provider? {primary_provider: environment.primary_provider}: {},
        __typename: 'DeploymentEnvironment'
    }
    const patch = [created]

    const method = variables.deployment_path? 'create_provider': 'update_environment'

    await unfurlServerUpdate({
        commitMessage: `Create environment '${environment.name}' in ${projectPath}`,
        projectPath,
        method: method,
        patch,
        branch,
        variables
    })

    return created
}

export async function postGitlabEnvironmentForm() {
    const environmentFormEntries = JSON.parse(sessionStorage['environmentFormEntries'])
    const environmentFormAction: string = sessionStorage['environmentFormAction']
    try {
        // axios rejects a 4xx/5xx itself
        return await postFormDataWithEntries(environmentFormAction, environmentFormEntries)
    } catch(_e) {
        // a refused create carries GitLab's validation errors, which say why
        const e = _e as Error & {response?: {data?: {message?: string | string[]}}}
        const reasons = e.response?.data?.message
        const message = Array.isArray(reasons) ? reasons.join(', ') : reasons || e.message
        throw new Error(`Failed to create dashboard environment: ${message}`)
    }
}

export function connectionsToArray(_environment: DeploymentEnvironment | unknown[]) {
    if(Array.isArray(_environment)) return _environment
    // rewritten in place from keyed objects to arrays
    const environment: Record<string, any> = _environment
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

export async function fetchEnvironments(options: {
    fullPath: string
    includeDeployments?: boolean
    branch?: string
    setCurrentBranch?: boolean
    only?: string
}) {
    const {fullPath, includeDeployments, branch, setCurrentBranch, only} = {
        includeDeployments: true,
        ...options
    }

    const projectPath = fullPath
    const format = 'environments'
    const errors: LoadError[] = []

    // TODO get the branch passed into fetch environments
    // TODO use ?include_deployments=true

    let data: Record<string, any> | undefined

    try {
        data = await unfurlServerExport({
            format,
            projectPath,
            includeDeployments,
            environment: only,
            branch,
            setCurrentBranch,
            // Pre-fetch the branch HEAD so the export carries a known-fresh
            // commit. If a local deploy left the working tree dirty,
            // /branches returns `<sha>-dirty` and the rust+python caches
            // both bypass so the deployment status reflects the new state.
            lastCommitResult: fetchLastCommit(projectPath, branch),
        })
    } catch(_e) {
        const e = _e as Error & {response?: {data?: unknown}}
        const responseData = e.response?.data
        errors.push({
            message: `Load environments: An error occurred during an export request (${e.message})`,
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
        return {errors, environments: []}
    }

    try {

    const environments = Object.entries(data!.DeploymentEnvironment as Record<string, DeploymentEnvironment>)
        .filter(([name, env]) => {
            if(env.error) {
                errors.push({
                    message: `Load environments: An error occurred during an environment export`,
                    context: {
                        ...env,
                        name
                    },
                    severity: 'major'

                })
                return false
            }

            return env.name != 'defaults'
        })
        .map(([_, env]) => {env._dashboard = fullPath; return env})

    for(const env of environments) {
        env._dashboard = fullPath
        Object.entries(env.instances!).forEach(([key, value]) => {
            const title = value.title || value.metadata?.title || key
            env.instances![key] = {...value, title, name: key}
        })
    }

    const deploymentPaths = Object.values(data!.DeploymentPath) as {name: string, environment: string}[]

    const defaults = data!.DeploymentEnvironment.defaults

    Object.values(data!.ResourceType).forEach(resourceType => {
        localNormalize(resourceType, 'ResourceType', null)
    })

    const result: {
        environments: DeploymentEnvironment[]
        deploymentPaths: typeof deploymentPaths
        fullPath: string
        defaults: DeploymentEnvironment
        ResourceType: Record<string, any>
        errors: LoadError[]
        deployments?: any[]
    } = {environments, deploymentPaths, fullPath, defaults, ResourceType: data!.ResourceType, errors}

    if(includeDeployments) {
        const deploymentErrors: DeploymentError[] = []

        // that filter is expected to be obsolete.
        // Guard against a partial/malformed response where `deployments` is missing —
        // a missing field shouldn't take out the whole environments load.
        const rawDeployments: any[] = data!.deployments || []
        const deployments = rawDeployments.filter(dep => !dep.ApplicationBlueprint || !Object.keys(dep.ApplicationBlueprint).includes('generic-cloud-provider-implementations'))
        // temporary error before removal so this goes loud
        if(deployments.length != rawDeployments.length) {
            result.errors.push({
                message: 'Assertion failed: An obsolete filter removed a deployment',
                context: {
                    filtered: _.cloneDeep(deployments),
                    unfiltered: _.cloneDeep(rawDeployments)
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

                const environment = deploymentPaths.find(dp => (new RegExp(`(/|^)${deploymentName}$`).test(dp.name)))!.environment
                deployment._environment = environment || 'defautlts'

                if(deployment.ResourceType) {
                    Object.values(deployment.ResourceType).forEach(rt => localNormalize(rt, 'ResourceType', deployment))
                }

                localNormalize(deploymentObject, 'Deployment', deployment)
            } catch(e) {
                deploymentErrors.push({
                    deployment: (Object.values(deployment.Deployment)[0] as {title: string}).title,
                    detail: 'Unexpected shape for deployment',
                    error: (e as Error).message,
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

    } catch(_e) {
        const e = _e as Error
        // A throw here means the export response was successful but had an unexpected
        // shape (missing/null field, etc.). Surface it as a structured error rather
        // than letting it escape as an uncaught TypeError that breaks downstream pages.
        errors.push({
            message: `Load environments: An error occurred while processing the export response (${e.message})`,
            context: {
                error: e.message,
                stack: e.stack,
                format,
                projectPath,
                includeDeployments,
                branch,
                topKeys: data && Object.keys(data),
            },
            severity: 'critical'
        })
        return {errors, environments: []}
    }
}

let _gitlabProjectEnvironments: Record<string, Promise<GitlabEnvironment[]> | undefined> = {}
export async function gitlabProjectEnvironments(projectPath: string) {
    const env = _gitlabProjectEnvironments[projectPath]
    if(env) return env
    return _gitlabProjectEnvironments[projectPath] = (() => axios.get(`/api/v4/projects/${encodeURIComponent(projectPath)}/environments`).then(res => res.data))()
}

export async function gitlabEnvironmentId(projectPath: string, environmentName: string) {
    const environments = await gitlabProjectEnvironments(projectPath)
    return environments.find((env: GitlabEnvironment) => env.name == environmentName)?.id
}

function encodeProviderString(providers: string[]) {
    return `http://localhost/${encodeURIComponent(providers.join(','))}`
}

function decodeProviderString(s: string | null) {
    return s && decodeURIComponent((new URL(s)).pathname.slice(1)).split(',')
}

export async function declareAvailableProviders(projectPath: string, environmentName: string, providerTypes: string[]) {
    if(window.gon.unfurl_gui) return

    const providers: (string | undefined)[] = _.uniqWith(providerTypes.map(lookupCloudProviderAlias), _.isEqual)

    if(providers.some(p => !p)) {
        throw new Error(`Set up cloud providers: unknown provider types among ${JSON.stringify(providerTypes)}`)
    }

    const environmentId = await gitlabEnvironmentId(projectPath, environmentName)
    if (!_.isNumber(environmentId)) {
        throw new Error(`Set up cloud providers: could not lookup environment ID for ${environmentName} in ${projectPath}`)
    }

    await axios.put(
        `/api/v4/projects/${encodeURIComponent(projectPath)}/environments/${environmentId}`,
        {
            external_url: encodeProviderString(providers as string[])
        }
    )
}

class DashboardProviders {
    project: ProviderProject

    constructor(data: {project: ProviderProject}) {
        this.project = data.project
    }

    get environments() {
        return this.project.environments.nodes
    }

    get fullPath() {
        return this.project.fullPath
    }

    get accessLevel() {
        return this.project.projectMembers!.nodes[0].accessLevel.integerValue
    }

    get providersByEnvironment() {
        const result: Record<string, ReturnType<typeof decodeProviderString>> = {}
        this.environments.forEach(env => {
            result[env.name] = decodeProviderString(env.externalUrl)
        })
        return result
    }

    primaryProviderFor(environmentName: string) {
        try {
            return this.providersByEnvironment[environmentName]![0]
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

    const response = await graphqlClient.query({
        query,
        variables: {username}
    })

    const {data, errors} = response
    const projects = data?.currentUser?.projectMemberships?.nodes

    if(!Array.isArray(projects)) {
        console.error(data)
        throw new Error(`Load cloud providers: could not read list of providers`)
    }

    return projects.map((p: {project: ProviderProject}) => new DashboardProviders(p)).filter(p => p.accessLevel >= minAccessLevel)
}

export const fetchDashboardProviders = _.memoize(async function (projectPath: string) {
    if(window.gon.unfurl_gui) {
        return null
    }

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
     const response = await graphqlClient.query({
        query,
        variables: {projectPath}
    })

    const {data, errors} = response

    if(errors) { throw new Error('Load cloud providers: ' + JSON.stringify(errors, null, 2)) }

    return data?.project ? new DashboardProviders({project: data.project}): null
})
