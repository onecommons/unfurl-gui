import axios from '~/lib/utils/axios_utils'
import { fetchUserAccessToken } from './user';
import { fetchProjectInfo, getLastCommit, setLastCommit, createBranch } from "./projects";
import { XhrIFrame } from './crossorigin-xhr';
import {DEFAULT_UNFURL_SERVER_URL, shouldEncodePasswordsInExportUrl, unfurlServerUrlOverride, alwaysSendLatestCommit, cloudmapRepo, lookupKey, setLocalStorageKey} from '../storage-keys';
import _ from 'lodash'

let pageAccessedByReload = false
try {
    pageAccessedByReload= (
        (window.performance.navigation && window.performance.navigation.type === 1) ||
            window.performance
                .getEntriesByType('navigation')
                .map((nav) => nav.type)
                .includes('reload')
    )
} catch(e) {}

let transientOverride

export function setTransientUnfurlServerOverride(override) {
    transientOverride = override
}

export function getTransientUnfurlServerOverride() {
    return transientOverride
}

function getOverride(projectPath) {
    return transientOverride || unfurlServerUrlOverride(projectPath)
}

function createHeaders({sendCredentials, username, password}) {
    const headers = {}
    const _sendCredentials = sendCredentials ?? true

    if(pageAccessedByReload) {
        headers['cache-control'] = 'no-cache'
    }

    if(_sendCredentials && username && password) {
        headers['x-git-credentials'] = btoa(username + ':' + password)
    }

    return headers
}

async function doXhr(projectPath, _method, url, body, headers) {
    const method = _method.toUpperCase()
    if(!['GET', 'POST'].includes(method)) throw new Error(`@doXhr: unexpected method for unfurl server "${method}"`)
    if(!getOverride(projectPath)) {
        let response
        if(method == 'GET') { response = await axios.get(url, {headers}) }
        else if(method == 'POST') { response = await axios.post(url, body, {headers}) }
        return response
    } else {
        let ufsvIFrame = doXhr.ufsvIFrame
        if(!doXhr.ufsvIFrame) { doXhr.ufsvIFrame = ufsvIFrame = new XhrIFrame({rejectErrorCode: true}) }

        // blocking forever in cypress
        await ufsvIFrame.ready

        return await ufsvIFrame.doXhr(...Array.from(arguments).slice(1))
    }

}

export function healthCheckIfNeeded(projectPath) {
    const url = unfurlServerUrlOverride(projectPath)
    if(!url) return

    const key = `ufsv_dev:${url}:${window.gon.current_username}:${projectPath}`
    if(lookupKey(key)) return

    if(!healthCheckIfNeeded.promise) {
        healthCheckIfNeeded.promise = (async () => {
            await doXhr(projectPath, 'GET', `${url}/health?start_development_session=${key}`)
            setLocalStorageKey(key, 'unused')
        })()
    }

    return healthCheckIfNeeded.promise
}

async function healthCheckErrorHelper(projectPath) {
    try {
        await healthCheckIfNeeded(projectPath)
    } catch(e) {
        throw new Error('Unable to reach Unfurl Server')
    }

}

// Resolve credentials + run the unfurl-server health check. Shared so the
// mechanics are in one place. The defaulting rule for `sendCredentials` is
// caller-controlled via `defaultSendCredentials`:
//   - `true`            → unconditionally send (unfurlServerExport's rule).
//   - `'public-aware'`  → look up project visibility and skip credentials for
//                         public projects (unfurlServerGetTypes's rule).
// In gui mode `fetchUserAccessToken` short-circuits to '' and the visibility
// lookup is skipped — no GitLab round-trips either way.
async function unfurlServerAuth({projectPath, sendCredentials, defaultSendCredentials = true}) {
    const shouldFetchProjectInfo =
        (sendCredentials ?? null) == null &&
        defaultSendCredentials === 'public-aware' &&
        !window.gon.unfurl_gui
    const fetchProjectInfoPromise = shouldFetchProjectInfo
        ? fetchProjectInfo(encodeURIComponent(projectPath)).then(pinfo => pinfo?.visibility)
        : null
    const [password, visibility] = await Promise.all([
        fetchUserAccessToken(),
        fetchProjectInfoPromise,
    ])
    await healthCheckErrorHelper(projectPath)
    const resolved = sendCredentials
        ?? (defaultSendCredentials === 'public-aware' ? visibility !== 'public' : true)
    return {
        sendCredentials: resolved,
        username: window.gon.current_username,
        password,
    }
}

// Shared between unfurlServerExport and unfurlServerGetTypes so the freshness
// contract stays in one place: build the URL with `auth_project` + optional
// branch + credentials, issue the GET, and seed sessionStorage with the
// server-reported latest_commit so the next request can send it as
// `latest_commit=<sha>` and take the proxy's cache fast-path.
async function unfurlServerGet({
    projectPath, endpoint, branch,
    query = [],
    sendCredentials, username, password,
    cacheBranch = branch,
}) {
    const baseUrl = getOverride(projectPath) || DEFAULT_UNFURL_SERVER_URL
    const includePasswordInQuery = shouldEncodePasswordsInExportUrl()

    const params = []
    if(sendCredentials && includePasswordInQuery && username && password) {
        params.push(`username=${username}`)
        params.push(`private_token=${password}`)
    }
    if(branch) params.push(`branch=${branch}`)
    params.push(`auth_project=${encodeURIComponent(projectPath)}`)
    for(const p of query) {
        if(p === undefined || p === null || p === '') continue
        params.push(p)
    }

    const url = `${baseUrl}${endpoint}?${params.join('&')}`.replace(/^\/+/, '/')
    const headers = createHeaders({
        sendCredentials: (!includePasswordInQuery && sendCredentials),
        username, password,
    })

    const data = (await doXhr(projectPath, 'GET', url, null, headers))?.data

    if (data?.latest_commit && cacheBranch) {
        setLastCommit(projectPath, cacheBranch, {commit: data.latest_commit})
    }
    return data
}

export async function unfurlServerExport({format, branch, projectPath, includeDeployments, sendCredentials, deploymentPath, environment, lastCommitResult: providedLastCommit}) {
    // Resolve latest_commit from the caller's tuple (which may be a promise) or
    // fall back to whatever sessionStorage already has. We never call
    // fetchLastCommit on our own: callers that need a guaranteed-fresh value
    // resolve it themselves and pass it in via `lastCommitResult`. When neither
    // source has a commit we omit `latest_commit` from the URL and accept
    // whatever the server's most-recent state happens to be.
    const [auth, resolvedFromCaller] = await Promise.all([
        unfurlServerAuth({projectPath, sendCredentials}),
        providedLastCommit,
    ])
    let lastCommitResult = resolvedFromCaller
    if (!lastCommitResult) {
        const cached = getLastCommit(projectPath, branch)
        if (cached) lastCommitResult = [cached.commit, branch, cached.queueid]
    }
    const [latestCommit, inferredBranch, queueid] = lastCommitResult || []

    const query = [`format=${format}`]
    // pass latest commit unless we're in developer mode for this project
    if(alwaysSendLatestCommit() || !unfurlServerUrlOverride(projectPath)) {
        if(latestCommit && branch && branch == inferredBranch) {
            query.push(`latest_commit=${latestCommit}`)
        }
    }
    query.push(`queueid=${queueid || 0}`)

    if(includeDeployments) {
        query.push('include_all_deployments=1')
    } else if(environment) {
        query.push(`environment=${environment}`)
    }

    if(format == 'deployment' && !deploymentPath) {
        throw new Error('Deployment path is required when exporting a deployment')
    }
    if(deploymentPath) {
        query.push(`deployment_path=${deploymentPath}`)
    }

    return await unfurlServerGet({
        projectPath, endpoint: '/export', branch,
        query, ...auth,
        cacheBranch: branch || inferredBranch,
    })
}

const unfurlTypesResponsesCache = {}
const constraintCombinationsWithCloudmap = {}
// export async function unfurlServerGetTypes({file, branch, projectPath, sendCredentials}, params={}, index) {
export async function unfurlServerGetTypes({file, branch, projectPath, sendCredentials}, _params={}, index) {
    // TODO remove when unfurl server types supports params
    const params = {implementation_requirements: _params.implementation_requirements}

    const cacheKey = JSON.stringify({branch, projectPath, ...params})
    if (unfurlTypesResponsesCache[cacheKey]) {
        return await unfurlTypesResponsesCache[cacheKey]
    }

    const auth = await unfurlServerAuth({
        projectPath, sendCredentials,
        defaultSendCredentials: 'public-aware',
    })

    const query = []

    if(!params.hasOwnProperty('cloudmap')) {
        const combinationKey = JSON.stringify(params)

        if(!constraintCombinationsWithCloudmap[combinationKey] && index == 0) {
            constraintCombinationsWithCloudmap[combinationKey] = true
            query.push(`cloudmap=${cloudmapRepo()}`)
        }
    }

    if(file) {
        // TODO don't split when it's working
        query.push(`file=${encodeURIComponent(file.split('#')[0])}`)
    }

    Object.entries(params).forEach(([key, value]) => {
        if(value === undefined) return
        if(Array.isArray(value)) {
            value.forEach(v => query.push(`${key}=${encodeURIComponent(v)}`))
        } else {
            query.push(`${key}=${encodeURIComponent(value)}`)
        }
    })

    const result = unfurlServerGet({
        projectPath, endpoint: '/types', branch,
        query, ...auth,
    })
    unfurlTypesResponsesCache[cacheKey] = result

    return await result
}

export function repoToExportParams(repo) {
    let url
    try {
        url = new URL(repo.url)
    } catch (e) {
        // repo.url may be empty or a bare filesystem path (e.g. `unfurl serve --gui`
        // on a local project); nothing to export via unfurl-server in that case.
        return null
    }
    const projectPath = url.pathname.slice(1).replace(/\.git$/, '')

    const [branch, _file] = (url.hash?.slice(1) || '').split(':')
    const file = repo.file || _file

    const result = {branch, projectPath}

    if(file) {
        result.file = file
    }

    return result
}

export function importsAreEqual(a, b) {
    return _.isEqual(repoToExportParams(a), repoToExportParams(b))
}

function groupTemplatesByPrimary(typesExportDict) {
    const appBlueprint = Object.values(typesExportDict.ApplicationBlueprint || {})[0]
    if(!appBlueprint) return {}

    try {
        const primary = typesExportDict.ResourceType[appBlueprint.primary]

        if(primary.directives.includes('substitute')) {
            return {
                [primary.name]: {
                    shared: typesExportDict.ResourceTemplate,
                    local: _.mapValues( // dict with cloud provider types => local templates
                        _.mapKeys( // does not account for multiple deployment templates per cloud
                            typesExportDict.DeploymentTemplate,
                            value => value.cloud
                        ),  dt => (dt.ResourceTemplate || {}))
                }
            }
        }

    } catch(e) {
        return {}
    }
}

// just assume all repositories are public forn now
export async function fetchTypeRepositories(repositories, params) {
    const tempOnly = params?.tempOnly; delete params?.tempOnly

    function filterRepositories(repo) {
        if(tempOnly && !repo.temp) return false
        return true
    }

    const typesDictionaries = await (Promise.all(
        repositories
            .filter(filterRepositories)
            .map(repo => repoToExportParams(repo))
            .filter(exportParams => exportParams !== null)
            .map((exportParams, i) => unfurlServerGetTypes(exportParams, params, i))
    ))

    let nestedTemplatesByPrimary = {}
    // hopefully this won't hurt too badly if fetch results are small

    const types = {}
    const categories = {}

    if(typesDictionaries.length) {
        // track all templates that might be copied for node substitution later
        nestedTemplatesByPrimary = Object.assign({}, ...typesDictionaries.map(groupTemplatesByPrimary))

        typesDictionaries.forEach(td => {
            Object.entries(td.ResourceType).forEach(([key, value]) => {
                if(types[key] && value._sourceinfo?.incomplete) {
                    return
                }

                types[key] = value
            })

            Object.entries(td.Overview?.categories || {}).forEach(([key, value]) => {
                categories[key] = value
            })
        })
    }


    return _.cloneDeep({types, categories, nestedTemplatesByPrimary})
    // return _.cloneDeep(Object.assign.apply(null, typesDictionaries))
}

export async function unfurlServerUpdate({method, projectPath, branch, patch, commitMessage, variables, sync}) {
    const baseUrl = getOverride(projectPath) || DEFAULT_UNFURL_SERVER_URL
    const username = window.gon.current_username
    let {commit, queueid, when} = getLastCommit(projectPath, branch)
    if (!commit) {
        throw new Error('@unfurlServerUpdate: no commit found for update, unable to proceed')
    }
    let password = await fetchUserAccessToken()
    await healthCheckErrorHelper(projectPath)

    const body = {
        ...variables,
        branch,
        latest_commit: commit,
        patch,
        commit_msg: commitMessage || method,
    }
    // Omitting queueid forces the server to process the patch synchronously and
    // enforce the optimistic latest_commit lock (returning 409 on conflict)
    // rather than queueing the work.
    if (!sync) {
        body.queueid = queueid || 0
    }

    const headers = createHeaders({username, password})
    headers['Content-Type'] = 'application/json'
    let url = `${baseUrl}/${method}`.replace(/^\/+/, '/')
    url += `?auth_project=${encodeURIComponent(projectPath)}`

    let data

    try {
        data = (await doXhr(projectPath, 'POST', url, body, headers)).data
    } catch(e) {
        if(e.response?.status == 409) {
            setLastCommit(projectPath, branch, undefined)
        }

        throw e
    }

    if(data.commit) {
        setLastCommit(projectPath, branch, data)
    } else if(typeof data.queueid !== 'undefined') {
        // Rust-proxy queued response: {queueid: N} with no commit. The
        // patch is enqueued against the latest_commit we sent and Python
        // hasn't applied it yet. Keep that latest_commit as our stored
        // commit so subsequent requests carry it, and bump the queueid
        // so the next request takes inc_queueid's normal path instead of
        // tripping the "pending batch" sync-write rejection.
        setLastCommit(projectPath, branch, {commit, queueid: data.queueid, when})
    } else {
        throw new Error('@unfurlServerUpdate: failed to set last commit')
    }
    return data
}
