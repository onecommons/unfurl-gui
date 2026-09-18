import axios from '~/lib/utils/axios_utils'
import { fetchUserAccessToken } from './user';
import { fetchProjectInfo, getLastCommit, setLastCommit, discardQueuedWrite, getProjectCurrentBranch, setProjectCurrentBranch, getProjectDefaultBranch, setProjectDefaultBranch, createBranch } from "./projects";
import { ensureWatching } from './unfurl-server-events';
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
        // The lookup only decides whether to skip credentials. A project the
        // instance doesn't host (a dashboard importing types from elsewhere)
        // 404s here, and letting that reject would abort the fetch it was only
        // trying to optimise -- fall back to sending credentials instead.
        ? fetchProjectInfo(encodeURIComponent(projectPath))
            .then(pinfo => pinfo?.visibility)
            .catch(() => undefined)
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

// Build the URL with `auth_project` + optional
// branch + credentials, issue the GET, and seed sessionStorage with the
// server-reported latest_commit so the next request can send it as
// `latest_commit=<sha>` and take the proxy's cache fast-path.
async function unfurlServerGet({
    projectPath, endpoint, branch,
    query = [],
    sendCredentials, username, password,
    // false only when the request's branch was pinned by an explicit
    // branch=<name> url parameter on the page route (?branch=, ?bprev=) —
    // those must not overwrite the project's current_branch
    setCurrentBranch = true,
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

    let data
    try {
        data = (await doXhr(projectPath, 'GET', url, null, headers))?.data
    } catch(e) {
        /*
         * The write this read was waiting on was discarded, so the queueid we
         * sent names a revision that will never exist and polling for it can
         * only time out. Drop the queueid -- not the commit, which the backend
         * rolled the batch back to and is still current -- so the next read
         * takes the ordinary path, and rethrow: a read that silently succeeded
         * here would put the pre-write state on screen as though nothing had
         * been lost, which is the failure this whole path exists to remove.
         */
        if(e.response?.status == 409 && e.response?.data?.code == 'WRITE_DISCARDED') {
            discardQueuedWrite(projectPath, branch)
        }
        // as in unfurlServerUpdate: axios only sets e.message to "Request failed
        // with status code N", and callers interpolate it into what the user reads
        const serverMessage = e.response?.data?.message
        if(serverMessage) e.message = serverMessage
        throw e
    }

    const projectId = encodeURIComponent(projectPath)
    const responseBranch = data?.branch
    if (responseBranch && setCurrentBranch) {
        setProjectCurrentBranch(projectId, responseBranch)
    }
    // response may opportunistically report the project's default branch. Unlike
    // current_branch this is a fact about the project, not about this request,
    // so no gating — record it whenever it changed.
    const responseDefaultBranch = data?.default_branch
    if (responseDefaultBranch && responseDefaultBranch !== getProjectDefaultBranch(projectId)) {
        setProjectDefaultBranch(projectId, responseDefaultBranch)
    }
    // key the latest_commit writeback by the branch the server says it ran
    // against — authoritative
    if (data?.latest_commit && responseBranch) {
        setLastCommit(projectPath, responseBranch, {commit: data.latest_commit})
    }
    return data
}

export async function unfurlServerExport({format, branch, projectPath, includeDeployments, sendCredentials, deploymentPath, environment, lastCommitResult: providedLastCommit, setCurrentBranch = true}) {
    const resolvedFromCache = !branch
    if (!branch) {
    // If the caller didn't pin a branch, use the branch a previous export
    // response reported using (recorded by unfurlServerGet).
      branch = getProjectCurrentBranch(encodeURIComponent(projectPath))
    }
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
    if (!lastCommitResult && branch) {
        const cached = getLastCommit(projectPath, branch)
        if (cached) lastCommitResult = [cached.commit, branch, cached.queueid]
    }
    const [latestCommit, inferredBranch, queueid] = lastCommitResult || []

    const query = [`format=${format}`]
    // if we specified a branch, pass latest commit unless we're in developer mode for this project
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

    try {
        return await unfurlServerGet({
            projectPath, endpoint: '/export', branch,
            query, ...auth,
            setCurrentBranch,
        })
    } catch(e) {
        // don't let a stale cached current_branch pin every subsequent
        // branchless export to a failing request
        if (resolvedFromCache && branch) {
            setProjectCurrentBranch(encodeURIComponent(projectPath), undefined)
        }
        throw e
    }
}

const unfurlTypesResponsesCache = {}
const constraintCombinationsWithCloudmap = {}
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

/*
 * Block until a queued write has actually committed.
 *
 * A queued write is acknowledged when the proxy enqueues it, not when it
 * commits: measured at 2-4ms against a batch that committed ~3s later. Anything
 * that asks GitLab for a pipeline inside that window loses a race it cannot
 * see, because GitLab resolves `ref` to a SHA when the pipeline is *created* --
 * so the job checks out a commit that predates the write and the deployment
 * directory is simply absent. Retrying in the runner cannot help; the SHA is
 * already wrong.
 *
 * The proxy answers 503 while `check_export_queue` still reports Retry (the
 * queue entry's queueid is behind ours) and nothing on this side was retrying.
 * An export carrying the queueid is the same wait reads already do; on success
 * unfurlServerGet stores the new commit, which clears the queueid.
 */
export async function awaitQueuedWrite(projectPath, branch, {timeoutMs = 90000, intervalMs = 500} = {}) {
    const resolvedBranch = branch || getProjectCurrentBranch(encodeURIComponent(projectPath))
    if(!resolvedBranch) return null

    const before = getLastCommit(projectPath, resolvedBranch)
    // no queueid means the write was applied synchronously, or has already
    // been waited on -- either way there is nothing outstanding
    if(!before?.queueid) return null

    const deadline = Date.now() + timeoutMs
    for(;;) {
        try {
            const data = await unfurlServerExport({
                format: 'environments', branch: resolvedBranch, projectPath,
            })
            const after = data?.latest_commit ?? null
            /*
             * Waiting on the queueid is necessary but not sufficient. A batch
             * that commits nothing answers 200 with the commit we sent, and the
             * queueid resolves immediately, so the wait succeeds and reports
             * nothing wrong -- from the queue's side the batch really did
             * finish. The caller then pins a pipeline to a SHA that predates
             * its own write. An unmoved commit is the only signal, so say so
             * here rather than let it surface as a job that cannot find its
             * deployment directory.
             *
             * Two causes, per unfurl-4a: the patch changed nothing on disk, or
             * the server's working copy was already dirty on entry -- which it
             * logs as "local repository at <path> was dirty, not committing or
             * pushing" and then reports success anyway. The second is sticky:
             * once dirty, every later write silently no-commits.
             */
            if(after && before.commit && after == before.commit) {
                throw new Error(
                    `the server reported success but committed nothing (still ${after.slice(0, 8)}). ` +
                    'Either the patch changed nothing, or the server\'s working copy was dirty -- ' +
                    'check its log for "was dirty, not committing or pushing".'
                )
            }
            return after
        } catch(e) {
            // 503 is the proxy saying the batch has not drained yet. Everything
            // else -- 409 WRITE_DISCARDED included -- belongs to the caller.
            if(e.response?.status != 503 || Date.now() >= deadline) throw e
            const retryAfter = Number(e.response.headers?.['retry-after']) * 1000
            await new Promise(resolve => setTimeout(resolve, retryAfter > 0 ? retryAfter : intervalMs))
        }
    }
}

export async function unfurlServerUpdate({method, projectPath, branch, patch, commitMessage, variables, sync}) {
    if (!branch) {
        throw new Error(`Update Unfurl Server: branch is required (method=${method}, projectPath=${projectPath})`)
    }
    const baseUrl = getOverride(projectPath) || DEFAULT_UNFURL_SERVER_URL
    const username = window.gon.current_username
    // `|| {}`: a prior 409 can leave nothing stored, and destructuring undefined
    // throws a TypeError naming the bundler's import instead of the real problem,
    // which the check just below already states plainly.
    let {commit, queueid, when} = getLastCommit(projectPath, branch) || {}
    if (!commit) {
        throw new Error('Update Unfurl Server: no commit found for update, unable to proceed')
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
            /*
             * Clear the stored commit *and* queueid. Resetting the queueid to 0
             * and keeping the commit does not work: inc_queueid's script fails
             * any request whose queueid is below the key's current value
             * (`if last_queueid > queueid then return "error"`), so 0 loses
             * against a key that has already advanced -- forever. Only a fresh
             * export can supply a commit/queueid pair the server will accept.
             */
            setLastCommit(projectPath, branch, undefined)
        }

        // The server explains itself in the body ({code, message}) -- "stale queueid",
        // or which upstream status discarded a queued write. axios only ever sets
        // e.message to "Request failed with status code N", and callers interpolate
        // e.message straight into what the user reads, so prefer the body's message.
        const serverMessage = e.response?.data?.message
        if(serverMessage) e.message = serverMessage

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
        // the entry just written is the watch set; ensureWatching re-reads it
        // and no-ops when it has not changed
        ensureWatching(projectPath, baseUrl)
    } else {
        throw new Error('Update Unfurl Server: failed to set last commit')
    }
    setProjectCurrentBranch(projectPath, branch)
    return data
}
