import gql from 'graphql-tag'
import graphqlClient from 'oc/graphql_shim'
import axios from '~/lib/utils/axios_utils'
import {DEFAULT_UNFURL_SERVER_URL, unfurlServerUrlOverride} from '../storage-keys'
import * as semver from 'semver'

const BRANCH_CACHE_DURATION = 1000 * 60 * 5 // 5 minutes

function generateConfig(options) {
    if(options?.accessToken) {
        return {headers: {
            'PRIVATE-TOKEN': options.accessToken
        }}
    }
}


const projectInfos = {}
const branchesData = {}

// default branches are persisted to sessionStorage (like get/setLastCommit)
// so a page load can resolve the default branch without a /branches round-trip
function defaultBranchSessionStorageKey(projectId) {
    return `${projectId}.default_branch`
}

export function setProjectDefaultBranch(projectId, branch) {
    if (branch === undefined) {
        delete sessionStorage[defaultBranchSessionStorageKey(projectId)]
    } else {
        sessionStorage[defaultBranchSessionStorageKey(projectId)] = JSON.stringify(branch)
    }
}

export function getProjectDefaultBranch(projectId) {
    let result
    try {
        result = JSON.parse(sessionStorage[defaultBranchSessionStorageKey(projectId)])
    } catch (e) { }
    return result
}

// the branch the unfurl server actually used for a project's export when the
// request didn't pin one — reported by the server in the export response and
// recorded by unfurlServerGet. Kept separate from default_branch: an explicit
// ?branch= request must never overwrite it.
function currentBranchSessionStorageKey(projectId) {
    return `${projectId}.current_branch`
}

export function setProjectCurrentBranch(projectId, branch) {
    if (branch === undefined) {
        delete sessionStorage[currentBranchSessionStorageKey(projectId)]
    } else {
        sessionStorage[currentBranchSessionStorageKey(projectId)] = JSON.stringify(branch)
    }
}

export function getProjectCurrentBranch(projectId) {
    let result
    try {
        result = JSON.parse(sessionStorage[currentBranchSessionStorageKey(projectId)])
    } catch (e) { }
    return result
}

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
    if(defaultBranch) setProjectDefaultBranch(projectId, defaultBranch.name)
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
                setProjectDefaultBranch(projectId, projectInfo.default_branch)
                setProjectDefaultBranch(projectInfo.id, projectInfo.default_branch)
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
    // saves the default branch to sessionStorage if it finds one, and caches the branchesData for BRANCH_CACHE_DURATION
    let result
    if(result = branchesData[projectId]) {
        return result
    }
    const promise = async () => (await axios.get(`/api/v4/projects/${projectId}/repository/branches`))?.data

    setTimeout(() => delete branchesData[projectId], BRANCH_CACHE_DURATION)
    return branchesData[projectId] = promise().catch(e => {
        // 404 means the project has no repository -- it was created moments
        // ago, or it isn't at the path we looked for. Every caller treats the
        // result as a list and copes with an empty one, whereas raising
        // surfaces two calls up in fetchProjectEnvironments' catch as
        // "Could not fetch project environments", which describes neither.
        if(e?.response?.status != 404) throw e
        // don't let a transient 404 sit in the cache for BRANCH_CACHE_DURATION
        delete branchesData[projectId]
        return []
    }).then(branches => {
        if (!Array.isArray(branches)) return []
        const defaultBranch = branches.length == 1? branches[0]: branches.find(b => b.default)
        if(defaultBranch) {
            setProjectDefaultBranch(projectId, defaultBranch.name)
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
        // `stale` -- not `supersedes`, which is a different fact about the
        // commit -- means a superseded frame told us another write was queued
        // from this base. It has to persist: it is what keeps the branch out of
        // the watch set across reconnects, and only a fresh read clears it,
        // because only a fresh read has the data we are missing.
        let {commit, queueid, when, supersedes, stale} = commit_data
        if (supersedes === undefined) {
            // The commit this one replaces, so fetchLastCommit can tell "/branches
            // hasn't caught up with a write we just made" (it reports exactly this)
            // from "something else moved the branch on" (it reports anything else).
            // Carried forward when the commit is unchanged so a repeated write
            // doesn't make us forget what we superseded.
            const previous = getLastCommit(projectId, branch)
            supersedes = previous?.commit === commit ? previous?.supersedes : previous?.commit
        }
        if (!queueid) {
            queueid = 0
        }
        sessionStorage[commitSessionStorageKey(projectId, branch)] =
            JSON.stringify({commit, queueid, when, supersedes, stale})
    }
}

/*
 * The write queue's state for one branch: every base commit with a live key.
 *
 * `/branches` says what the repo is at, this says what is queued against it.
 * They are independent facts joined on the commit, so they race rather than
 * sequence -- which is the whole point, since a client with nothing in flight
 * has no watch to carry any of this.
 *
 * Fail-soft by contract. The endpoint is the rust proxy's: a server with no
 * redis answers 503 NO_QUEUE and one with no proxy in front of it 404s, and
 * neither is a reason for an ordinary read to fail. Returns null when there is
 * nothing to say.
 */
export async function fetchQueueState(projectPath, branch) {
    const base = unfurlServerUrlOverride(projectPath) || DEFAULT_UNFURL_SERVER_URL
    const url = `${base}/queue_state?auth_project=${encodeURIComponent(projectPath)}`
        + `&branch=${encodeURIComponent(branch)}`

    try {
        const {data} = await axios.get(url.replace(/^\/+/, '/'))
        return data?.commits || null
    } catch (e) {
        return null
    }
}

// Returns [commit, branch, queueid, changed] where `changed` is true iff this
// call wrote a different commit to sessionStorage than was there before. Callers
// can use this flag as a "has the upstream moved since we last looked?" signal
// without needing to read sessionStorage themselves (which would race with our
// own writeback below).
export async function fetchLastCommit(projectPath, _branch) {
    const projectId = encodeURIComponent(projectPath)
    const branch = _branch || await getOrFetchCurrentBranch(projectId)
    let lastInSessionStorage = getLastCommit(projectPath, branch)
    if (lastInSessionStorage?.queueid) {
        // if there's queueid > 0, it means we have an in-flight commit
        return [lastInSessionStorage.commit, branch, lastInSessionStorage.queueid, false]
    }

    // fetchBranches returns local branchesData if present. Raced with the
    // queue, not sequenced: neither answer depends on the other.
    const [branches, queued] = await Promise.all([
        fetchBranches(projectId),
        fetchQueueState(projectPath, branch),
    ])

    const {commit, name} = branches.find(b => branch? b.name == branch: b.default) || branches.find(b => b.name == 'main') || {}
    const {id, created_at} = commit || {}  // note: same as committed_date

    // A `-dirty` suffix from /branches means the on-disk working tree was
    // uncommitted at the time of the lookup, so the sha is not a commit we
    // could ever have superseded; trust the API value unconditionally.
    const isDirty = typeof id === 'string' && id.endsWith('-dirty')
    if (isDirty) {
        // eslint-disable-next-line no-console -- deliberate diagnostic, see above
        console.debug(`fetchLastCommit got dirty commit: ${projectPath}#${name} -> ${id}`)
    }
    // Keep ours only while the API is still reporting the commit ours replaced.
    // This used to compare the API's committed_date against a wall-clock stamp
    // taken when we cached the value; those measure different things, so a
    // commit pushed by CI (its date older than our last cache write) lost the
    // comparison and the stale commit was pinned for the rest of the session.
    if (lastInSessionStorage?.commit && !isDirty && id === lastInSessionStorage.supersedes) {
        return [lastInSessionStorage.commit, branch, lastInSessionStorage.queueid, false]
    }
    /*
     * Only this sha's entry means anything: the queue key, and the counter in
     * it, are per base commit, so an entry for another sha is a fact about
     * someone else's base.
     *
     * `new_commit` is the one rule here that changes what we store -- a batch
     * against this commit already produced another, which `/branches` will not
     * report until the push propagates. The queue's other answers are
     * informational on this path: we reach it only with nothing in flight, so
     * there is no queueid of ours for a larger one to invalidate and none for
     * a `discarded` entry to strip.
     */
    const entry = !isDirty && queued?.[id]
    const current = (entry?.new_commit && entry.new_commit !== id) ? entry.new_commit : id

    const changed = current !== lastInSessionStorage?.commit
    setLastCommit(projectPath, branch, {commit: current, queueid: 0, when: created_at})
    return [current, name, 0, changed]
}

/*
 * A queued write we were waiting on will never land: drop the queueid so the
 * next read takes the ordinary path, but keep the commit, which the backend
 * rolled the batch back to and is still current.
 *
 * Shared by the 409 WRITE_DISCARDED response and the `discarded` event, which
 * are the same situation reached two ways.
 */
export function discardQueuedWrite(projectId, branch) {
    const stored = branch && getLastCommit(projectId, branch)
    if (!stored) return false

    setLastCommit(projectId, branch, {...stored, queueid: 0})
    return true
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
        setProjectDefaultBranch(projectId, branch)
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
    const _options = Object.assign({
        name: 'DashboardProjectAccessToken',
        scopes: ['read_repository', 'read_registry'],
        // 19.3 rejects a create without this: ResourceAccessTokens::CreateService
        // requires expires_at, and require_personal_access_token_expiry leaves no
        // permissive branch. The ceiling is 365 days; stop a day short so a leap
        // year or a timezone rounding can't push the value over it.
        expires_at: new Date(Date.now() + 364 * 864e5).toISOString().slice(0, 10)
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
    const response = await graphqlClient.query({
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
    const result = await graphqlClient.query({
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
    let result = getProjectDefaultBranch(projectId)
    if(!result) {
        await fetchBranches(projectId) // force population if not already cached
        result = getProjectDefaultBranch(projectId)
    }
    return result
}

// resolution for callers that want "the branch the server is serving this
// project from": prefer the branch a previous export response reported using,
// fall back to the default branch
export async function getOrFetchCurrentBranch(projectId) {
    return getProjectCurrentBranch(projectId) || await getOrFetchDefaultBranch(projectId)
}
