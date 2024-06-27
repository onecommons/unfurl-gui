import gql from 'graphql-tag'
import graphqlClient from 'oc/graphql-shim'
import axios from '~/lib/utils/axios_utils'
import * as semver from 'semver'

const BRANCH_CACHE_DURATION = 2000

function generateConfig(options) {
    if(options?.accessToken) {
        return {headers: {
            'PRIVATE-TOKEN': options.accessToken
        }}
    }
}


const projectInfos = {}
const branchesData = {}

export async function fetchProjects(options={}) {
    // TODO this probably doesn't need access level 40
    const {minAccessLevel} = options

    let _minAccessLevel = minAccessLevel ?? 40

    let result = (await axios.get(`/api/v4/projects?min_access_level=${_minAccessLevel}`, generateConfig(options)))?.data
    const dashboards = (await axios.get('/api/v4/dashboards?min_access_level=10', generateConfig(options))).data
        .map(dashboardProject => dashboardProject.path_with_namespace)

    result = result.filter(project => !dashboards.includes(project.path_with_namespace))
    return result
}

export async function fetchRegistryRepositories(projectId, options) {
    return (await axios.get(`/api/v4/projects/${projectId}/registry/repositories?per_page=99999`, generateConfig(options)))?.data
}

export async function fetchRepositoryBranches(projectId, options) {
    return (await axios.get(`/api/v4/projects/${projectId}/repository/branches?per_page=99999`, generateConfig(options)))?.data
}

export async function fetchRepositoryTags(projectId, options) {
    return (await axios.get(`/api/v4/projects/${projectId}/repository/tags?per_page=99999`, generateConfig(options)))?.data
}

export async function fetchCurrentTag(projectId) {
    let tags = await fetchRepositoryTags(projectId)

    tags = tags.filter(t => semver.valid(t.name))

    tags.sort((a,b) => semver.compare(a.name, b.name))

    return tags.pop()
}

export async function fetchProjectInfo(projectId, options) {
    if(!window.gon.unfurl_gui) {
        let result
        if(result = projectInfos[projectId]) {
            return result
        }
        const promise =  async() => (await axios.get(`/api/v4/projects/${projectId}`, generateConfig(options)))?.data

        return projectInfos[projectId] = promise()
    } else {
        if(typeof projectId != 'string') return null

        return {name: projectId.split(/(%2F|\/)/).pop()}
    }
}

export async function fetchProjectPipelines(projectId, options) {
    return (await axios.get(`/api/v4/projects/${projectId}/pipelines`, generateConfig(options)))?.data
}

export async function fetchProjectAccessTokens(projectId) {
    return (await axios.get(`/api/v4/projects/${projectId}/access_tokens`))?.data
}

export async function fetchCommit(projectId, commitHash) {
    return (await axios.get(`/api/v4/projects/${projectId}/repository/commits/${commitHash}`))?.data
}


export async function fetchBranches(projectId) {
    let result
    if(result = branchesData[projectId]) {
        return result
    }
    const promise = async () => (await axios.get(`/api/v4/projects/${projectId}/repository/branches`))?.data

    setTimeout(() => delete branchesData[projectId], BRANCH_CACHE_DURATION)
    return branchesData[projectId] = promise()
}


function commitSessionStorageKey(projectId, branch) {
    return `${projectId}#${branch}.latest_commit`
}

export function setLastCommit(projectId, branch, commit) {
    const when = (new Date(Date.now())).toISOString()
    sessionStorage[commitSessionStorageKey(projectId, branch)] = commit === undefined?
        undefined:
        JSON.stringify({commit, when})
}

export async function fetchLastCommit(projectId, _branch) {
    const [branch, branches] = await Promise.all([
        _branch, // allow provided branch to be a promise so they can be fetched in parallel?
        fetchBranches(projectId)
    ])

    const {commit, name} = branches.find(b => branch? b.name == branch: b.default) || branches.find(b => b.name == 'main') || {}
    const {id, created_at} = commit || {}

    let lastInSessionStorage
    try {
        lastInSessionStorage = JSON.parse(sessionStorage[commitSessionStorageKey(projectId, branch)])
    } catch(e) {}

    const fromAPI = new Date(created_at)
    const fromStore = new Date(lastInSessionStorage?.when || 0)

    if (lastInSessionStorage?.commit && fromStore > fromAPI) {
        return [lastInSessionStorage.commit, branch]
    }

    return [id, name || 'main']
}

export async function fetchBranch(projectId, branch) {
    return (await axios.get(`/api/v4/projects/${projectId}/repository/branches/${branch}`))?.data
}

export async function createBranch(projectId, branch, ref='main') {
    const response = await axios.post(`/api/v4/projects/${projectId}/repository/branches`, {branch, ref}, {validateStatus() {return true}})

    if(response.status >= 400) {
        console.error(response.data)
        throw new Error(`Couldn't create branch '${branch}'`)
    }

    try {
        branchesData[branchName] = branchesData[ref]
    } catch(e) {}

    return response.data
}

export async function generateProjectAccessToken(projectId, options) {
    console.log(`Generating a project token for ${projectId}`)
    const _options = Object.assign({
        name: 'DashboardProjectAccessToken',
        scopes: ['read_repository', 'read_registry']
    }, options)
    _options.id = projectId
    return (await axios.post(`/api/v4/projects/${projectId}/access_tokens`, _options))?.data?.token
}

const query = gql`
query getContainerRepositories($fullPath: ID!) {
    project(fullPath: $fullPath) {
        __typename
        id
        containerRepositoriesCount
        containerRepositories {
          __typename
          nodes {
            id
            name
            path
            status
            location
            __typename
          }
        }
    }
}
`

export async function fetchContainerRepositories(fullPath) {
    const response = await graphqlClient.clients.defaultClient.query({
        query,
        variables: {fullPath}
    })

    const nodes = response.data?.project?.containerRepositories?.nodes || []
    return nodes
}

const getUserPermissions = gql`
        query userPermissions($projectPath: ID!) {
            project(fullPath: $projectPath) {
                userPermissions {
                    pushCode
                    __typename
                }
            }
        }`


export async function fetchUserHasWritePermissions(projectPath) {

    // #!if false
    const result = await graphqlClient.defaultClient.query({
        query: getUserPermissions,
        variables: {projectPath},
        errorPolicy: 'all'
    })

    return result?.data?.project?.userPermissions?.pushCode ?? false
    // #!endif

    return true
}

export async function createMergeRequest(projectId, {branch, target, title, description, labels}) {
    const body = {}
    body['source_branch'] = branch
    body['target_branch'] = target
    body['title'] = title

    if(description) {
        body['description'] = description
    }

    if(labels) {
        const _labels = Array.isArray(labels)? labels.join(','): labels
        body['labels'] = _labels
    }

    return (await axios.post(`/api/v4/projects/${projectId}/merge_requests`, body))?.data
}

export async function listMergeRequests(projectId, {branch, target, labels, state}) {
    const params = []
    if(branch) {
        params.push(`source_branch=${branch}`)
    }
    if(target) {
        params.push(`target_branch=${target}`)
    }
    if(labels) {
        const _labels = Array.isArray(labels)? labels.join(','): labels
        params.push(`labels=${_labels}`)
    }
    if(state) {
        params.push(`state=${state}`)
    }

    return (await axios.get(`/api/v4/projects/${projectId}/merge_requests?${params.join('&')}`))?.data
}

export async function setMergeRequestReadyStatus(projectId, {branch, target, labels, state, status}) {
    const wip = status === false || status == 'wip'
    const [mr] = await listMergeRequests(...arguments)

    let title = mr.title.replace(/^\[Draft\]\s+/, '')
    if(wip) title = `[Draft] ${title}`
    return await axios.put(`/api/v4/projects/${projectId}/merge_requests/${mr.iid}`, {title})
}

export async function listProjectFiles(projectPath, {branch}={}) {
    return (await axios.get(`/${projectPath}/-/files/${branch || 'main'}?format=json`)).data
}
