import axios from '~/lib/utils/axios_utils'
import { fetchUserAccessToken } from './user';
import { fetchLastCommit, setLastCommit, createBranch } from "./projects";
import { XhrIFrame } from './crossorigin-xhr';
import {DEFAULT_UNFURL_SERVER_URL, shouldEncodePasswordsInExportUrl, unfurlServerUrlOverride, alwaysSendLatestCommit} from '../storage-keys';

function createHeaders({sendCredentials, username, password}) {
    const headers = {}
    const _sendCredentials = sendCredentials ?? true

    if(_sendCredentials && username && password) {
        headers['x-git-credentials'] = btoa(username + ':' + password)
    }

    return headers
}

let ufsvIFrame
if(unfurlServerUrlOverride()) { ufsvIFrame = new XhrIFrame() }

async function doXhr(_method, url, body, headers) {
    const method = _method.toUpperCase()
    if(!['GET', 'POST'].includes(method)) throw new Error(`@doXhr: unexpected method for unfurl server "${method}"`)
    if(!unfurlServerUrlOverride()) {
        let response
        if(method == 'GET') { response = await axios.get(url, {headers}) }
        else if(method == 'POST') { response = await axios.post(url, body, {headers}) }
        return response?.data
    } else {
        return await ufsvIFrame.doXhr(...arguments)
    }

}

export async function unfurlServerExport({format, branch, projectPath, includeDeployments, sendCredentials}) {
    const baseUrl = unfurlServerUrlOverride() || DEFAULT_UNFURL_SERVER_URL
    const [lastCommitResult, password] = await Promise.all([fetchLastCommit(encodeURIComponent(projectPath), branch), fetchUserAccessToken()])
    const [latestCommit, _branch] = lastCommitResult
    const _sendCredentials = sendCredentials ?? true

    if(!latestCommit) throw new Error('@unfurlServerExport: latestCommit is not defined')

    const username = window.gon.current_username

    let exportUrl = `${baseUrl}/export?format=${format}`

    const includePasswordInQuery = shouldEncodePasswordsInExportUrl()

    if(_sendCredentials && includePasswordInQuery && username && password) {
        exportUrl += `&username=${username}`
        exportUrl += `&private_token=${password}`
    }

    exportUrl += `&branch=${branch || _branch}`
    exportUrl += `&auth_project=${encodeURIComponent(projectPath)}`

    if(alwaysSendLatestCommit() || !unfurlServerUrlOverride()) {
        exportUrl += `&latest_commit=${latestCommit}`
    }

    if(includeDeployments) {
        exportUrl += '&include_all_deployments=1'
    }

    return await doXhr('GET', exportUrl, null, createHeaders({sendCredentials: (!includePasswordInQuery && _sendCredentials), username, password}))
}

export async function unfurlServerUpdate({method, projectPath, branch, patch, commitMessage, variables}) {
    console.log(arguments[0])
    const baseUrl = unfurlServerUrlOverride() || DEFAULT_UNFURL_SERVER_URL
    const username = window.gon.current_username
    const [password, lastCommitResult] = await Promise.all([fetchUserAccessToken(), fetchLastCommit(encodeURIComponent(projectPath), branch)])
    const [latestCommit, _branch] = lastCommitResult

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
        data = await doXhr('POST', url, body, headers)
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
