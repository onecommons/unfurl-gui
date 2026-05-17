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
const projectDefaultBranches = {}

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
    const result = (await axios.get(`/api/v4/projects/${projectId}/repository/branches?per_page=99999`, generateConfig(options)))?.data
    const defaultBranch = result.find(branch => branch.default)
    if(defaultBranch) projectDefaultBranches[projectId] = defaultBranch
    return result
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

        return projectInfos[projectId] = promise().then(projectInfo => {
            if(projectInfo.default_branch) {
                projectDefaultBranches[projectId] = projectInfo.default_branch
                projectDefaultBranches[projectInfo.id] = projectInfo.default_branch
            }
            return projectInfo
        })
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
    return branchesData[projectId] = promise().then(branches => {
        const defaultBranch = branches.length == 1? branches[0]: branches.find(b => b.default)
        if(defaultBranch) {
            projectDefaultBranches[projectId] = defaultBranch.name
        }
        return branches
    })
}


function commitSessionStorageKey(projectId, branch) {
    return `${projectId}#${branch}.latest_commit`
}

export function setLastCommit(projectId, branch, commit_data) {
    if (commit_data === undefined) {
        delete sessionStorage[commitSessionStorageKey(projectId, branch)]
    } else {
        let {commit, queueid, when} = commit_data
        if (!when) {
            when = (new Date(Date.now())).toISOString()
        }
        if (!queueid) {
            queueid = 0
        }
        sessionStorage[commitSessionStorageKey(projectId, branch)] = JSON.stringify({commit, queueid, when})
    }
}

// Returns [commit, branch, queueid, changed] where `changed` is true iff this
// call wrote a different commit to sessionStorage than was there before. Callers
// can use this flag as a "has the upstream moved since we last looked?" signal
// without needing to read sessionStorage themselves (which would race with our
// own writeback below).
export async function fetchLastCommit(projectPath, _branch) {
    let lastInSessionStorage = getLastCommit(projectPath, _branch)
    if (lastInSessionStorage?.queueid) {
        // if there's queueid > 0, it means we have an in-flight commit
        return [lastInSessionStorage.commit, _branch, lastInSessionStorage.queueid, false]
    }

    const projectId = encodeURIComponent(projectPath)
    // fetchBranches returns local branchesData if present
    let [branch, branches] = await Promise.all([
        _branch, // allow provided branch to be a promise so they can be fetched in parallel
        fetchBranches(projectId)
    ])
    if(!branch) branch = await getOrFetchDefaultBranch(projectId)

    const {commit, name} = branches.find(b => branch? b.name == branch: b.default) || branches.find(b => b.name == 'main') || {}
    const {id, created_at} = commit || {}  // note: same as committed_date

    const fromAPI = new Date(created_at)
    const fromStore = new Date(lastInSessionStorage?.when || 0)

    if (lastInSessionStorage?.commit && fromStore > fromAPI) {
        return [lastInSessionStorage.commit, branch, lastInSessionStorage.queueid, false]
    }
    const changed = id !== lastInSessionStorage?.commit
    setLastCommit(projectPath, branch, {commit: id, queueid: 0, when: created_at})
    return [id, name, 0, changed]
}

export function getLastCommit(projectId, branch) {
  let lastInSessionStorage
  try {
    lastInSessionStorage = JSON.parse(sessionStorage[commitSessionStorageKey(projectId, branch)])
  } catch (e) { }
  return lastInSessionStorage
}

export async function fetchBranch(projectId, branch) {
    const result = (await axios.get(`/api/v4/projects/${projectId}/repository/branches/${branch}`))?.data
    if(result.default) {
        projectDefaultBranches[projectId] = branch
    }
    return result
}

export async function createBranch(projectId, branch, ref) {
    const _ref = ref || await getOrFetchDefaultBranch(projectId)

    const response = await axios.post(`/api/v4/projects/${projectId}/repository/branches`, {branch, ref: _ref}, {validateStatus() {return true}})

    let commitId

    if (response.status === 400 && /already exists/i.test(response.data?.message || '')) {
        console.warn(`createBranch: branch '${branch}' already exists on ${projectId}; using existing branch`)
        const existing = await fetchBranch(projectId, branch)
        commitId = existing?.commit?.id
    } else if (response.status >= 400) {
        console.error(response.data)
        throw new Error(`Couldn't create branch '${branch}'`)
    } else {
        commitId = response.data?.commit?.id
    }

    if (commitId) {
        setLastCommit(decodeURIComponent(projectId), branch, {commit: commitId})
    }

    try {
        branchesData[branch] = branchesData[_ref]
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

    // #!if !standalone
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
    const _branch = branch || await getOrFetchDefaultBranch(encodeURIComponent(projectPath))
    return (await axios.get(`/${projectPath}/-/files/${_branch}?format=json`)).data
}

export async function getOrFetchDefaultBranch(projectId) {
    let result = projectDefaultBranches[projectId]
    if(result === '') result = 'HEAD'
    if(!result) {
        await fetchBranches(projectId) // force population
        result = projectDefaultBranches[projectId]
    }
    return result
}
