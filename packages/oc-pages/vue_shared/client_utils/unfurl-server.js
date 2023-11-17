import axios from '~/lib/utils/axios_utils'
import { fetchUserAccessToken } from './user';
import { fetchLastCommit, setLastCommit, createBranch } from "./projects";
import { XhrIFrame } from './crossorigin-xhr';
import {DEFAULT_UNFURL_SERVER_URL, shouldEncodePasswordsInExportUrl, unfurlServerUrlOverride, alwaysSendLatestCommit, cloudmapRepo, lookupKey, setLocalStorageKey} from '../storage-keys';
import _ from 'lodash'

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

export async function unfurlServerExport({format, branch, projectPath, includeDeployments, sendCredentials, deploymentPath, environment}) {
    const baseUrl = getOverride(projectPath) || DEFAULT_UNFURL_SERVER_URL
    const [lastCommitResult, password] = await Promise.all([fetchLastCommit(encodeURIComponent(projectPath), branch), fetchUserAccessToken()])
    const [latestCommit, _branch] = lastCommitResult
    const _sendCredentials = sendCredentials ?? true
    await healthCheckErrorHelper(projectPath)

    if(!latestCommit) throw new Error(`@unfurlServerExport: latestCommit is not defined for ${projectPath}#${branch}`)

    const username = window.gon.current_username

    let exportUrl = `${baseUrl}/export?format=${format}`

    const includePasswordInQuery = shouldEncodePasswordsInExportUrl()

    if(_sendCredentials && includePasswordInQuery && username && password) {
        exportUrl += `&username=${username}`
        exportUrl += `&private_token=${password}`
    }

    exportUrl += `&branch=${branch || _branch}`
    exportUrl += `&auth_project=${encodeURIComponent(projectPath)}`

    // if(alwaysSendLatestCommit() || !getOverride(projectPath)) {
    // pass latest commit when it's not the repo we're developing
    if(alwaysSendLatestCommit() || !unfurlServerUrlOverride(projectPath)) {
        exportUrl += `&latest_commit=${latestCommit}`
    }

    if(includeDeployments) {
        exportUrl += '&include_all_deployments=1'
    } else if(environment) {
        exportUrl += `&environment=${environment}`
    }

    if(format == 'deployment') {
        if(! deploymentPath) throw new Error('Deployment path is required when exporting a deployment')

        exportUrl += `&deployment_path=${deploymentPath}`
    }

    return (await doXhr(projectPath, 'GET', exportUrl, null, createHeaders({sendCredentials: (!includePasswordInQuery && _sendCredentials), username, password})))?.data
}

const unfurlTypesResponsesCache = {}
const constraintCombinationsWithCloudmap = {}
// export async function unfurlServerGetTypes({file, branch, projectPath, sendCredentials}, params={}, index) {
export async function unfurlServerGetTypes({file, branch, projectPath, sendCredentials}, _params={}, index) {
    // TODO remove when unfurl server types supports params
    const params = {implementation_requirements: _params.implementation_requirements}
    const baseUrl = getOverride() || DEFAULT_UNFURL_SERVER_URL

    // this is rather convoluted, but we don't want to fetch last commit for a tagged release
    // this code would probably be removed once unfurl server doesn't need a last commit
    // the only other reason to hit branches would be to get the main branch

    const fetchCommitPromise = (branch && !branch.startsWith('v'))? fetchLastCommit(encodeURIComponent(projectPath), branch): null
    const [lastCommitResult, password] = await Promise.all([fetchCommitPromise, fetchUserAccessToken()])
    const [latestCommit, _branch] = lastCommitResult || [null, branch]
    const _sendCredentials = sendCredentials ?? true
    await healthCheckErrorHelper(projectPath)

    const cacheKey = JSON.stringify({branch, projectPath, ...params})

    if (unfurlTypesResponsesCache[cacheKey]) {
        return await unfurlTypesResponsesCache[cacheKey]
    }

    const username = window.gon.current_username

    let exportUrl = `${baseUrl}/types`

    exportUrl += `?auth_project=${encodeURIComponent(projectPath)}`

    if(!params.hasOwnProperty('cloudmap')) {
        const combinationKey = JSON.stringify(params)

        if(!constraintCombinationsWithCloudmap[combinationKey] && index == 0) {
            constraintCombinationsWithCloudmap[combinationKey] = true
            exportUrl += `&cloudmap=${cloudmapRepo()}`
        }
    }

    const includePasswordInQuery = shouldEncodePasswordsInExportUrl()

    if(_sendCredentials && includePasswordInQuery && username && password) {
        exportUrl += `&username=${username}`
        exportUrl += `&private_token=${password}`
    }

    exportUrl += `&branch=${branch || _branch}`

    if(file) {
        // TODO don't split when it's working
        exportUrl += `&file=${encodeURIComponent(file.split('#')[0])}`
    }

    if(latestCommit && (alwaysSendLatestCommit() || !getOverride(projectPath))) {
        exportUrl += `&latest_commit=${latestCommit}`
    }

    Object.entries(params).forEach(([key, value]) => {
        if(value === undefined) return
        if(Array.isArray(value)) {
            value.forEach(value => exportUrl += `&${key}=${encodeURIComponent(value)}`)
        } else {
            exportUrl += `&${key}=${encodeURIComponent(value)}`
        }
    })

    const result = doXhr(projectPath, 'GET', exportUrl, null, createHeaders({sendCredentials: (!includePasswordInQuery && _sendCredentials), username, password})).then(res => res.data)
    unfurlTypesResponsesCache[cacheKey] = result

    return await result
}

export function repoToExportParams(repo) {
    const url = new URL(repo.url)
    const projectPath = url.pathname.slice(1).replace(/\.git$/, '')

    const [_branch, _file] = (url.hash?.slice(1) || '').split(':')
    const branch = _branch || 'main'
    const file = repo.file || _file

    const result = {branch: branch, projectPath}

    if(file) {
        result.file = file
    }

    return result
}

export function importsAreEqual(a, b) {
    return _.isEqual(repoToExportParams(a), repoToExportParams(b))
}

// just assume all repositories are public forn now
export async function fetchTypeRepositories(repositories, params) {
    const typesDictionaries = await (Promise.all(repositories.map(
        (repo, i) => unfurlServerGetTypes(repoToExportParams(repo), params, i)
            .then(typesResponse => typesResponse.ResourceType)
    )))

    if(!typesDictionaries.length) return {}
    // hopefully this won't hurt too badly if fetch results are small

    const result = {}

    typesDictionaries.forEach(td => {
        Object.entries(td).forEach(([key, value]) => {
            if(result[key] && value._sourceinfo?.incomplete) {
                return
            }

            result[key] = value
        })
    })
    return _.cloneDeep(result)
    // return _.cloneDeep(Object.assign.apply(null, typesDictionaries))
}

export async function unfurlServerUpdate({method, projectPath, branch, patch, commitMessage, variables}) {
    const baseUrl = getOverride(projectPath) || DEFAULT_UNFURL_SERVER_URL
    const username = window.gon.current_username
    const [password, lastCommitResult] = await Promise.all([fetchUserAccessToken(), fetchLastCommit(encodeURIComponent(projectPath), branch)])
    const [latestCommit, _branch] = lastCommitResult
    await healthCheckErrorHelper(projectPath)

    if(_branch != branch) {
        await createBranch(encodeURIComponent(projectPath), branch, latestCommit)
    }

    const body = {
        ...variables,
        branch: branch || _branch,
        latest_commit: latestCommit,
        patch,
        commit_msg: commitMessage || method
    }
    const headers = createHeaders({username, password})
    headers['Content-Type'] = 'application/json'
    const url = `${baseUrl}/${method}?auth_project=${encodeURIComponent(projectPath)}`

    let data

    try {
        data = (await doXhr(projectPath, 'POST', url, body, headers)).data
    } catch(e) {
        if(e.response?.status == 409) {
            setLastCommit(encodeURIComponent(projectPath), branch, undefined)
        }

        throw e
    }

    if(data.commit) {
        setLastCommit(encodeURIComponent(projectPath), branch, data.commit)
    } else {
        throw new Error('@unfurlServerUpdate: failed to set last commit')
    }
    return data
}
