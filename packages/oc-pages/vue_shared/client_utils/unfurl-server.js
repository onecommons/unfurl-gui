import axios from '~/lib/utils/axios_utils'
import { fetchUserAccessToken } from './user';
import { fetchLastCommit, setLastCommit } from "./projects";
import {XHR_JAIL_URL, DEFAULT_UNFURL_SERVER_URL, shouldEncodePasswordsInExportUrl, unfurlServerUrlOverride, alwaysSendLatestCommit} from '../storage-keys';

function createHeaders({includePasswordInQuery, username, password}) {
    const headers = {}

    if(!includePasswordInQuery && username && password) {
        headers['x-git-credentials'] = btoa(username + ':' + password)
    }

    return headers
}

function genUid() {
    return Math.random().toString(36).slice(-6)
}

class UnfurlServerIFrame {
    /*
     * example XHR handler
    window.addEventListener('xhr', async ({detail}) => {
        const {eventId, method, url, body, headers} = detail
        const _headers = new Headers()

        Object.entries(headers).forEach(([key, value]) => _headers.append(key, value))

        const options = {
            method,
            headers: _headers
        }

        if(method == 'POST') options.body = body

        const response = await fetch(url, options)

        const status = response.status
        const payload = await response.json()
        const event = new CustomEvent(eventId, {detail: {status, payload}})

        window.parent.document.dispatchEvent(event)
    })
    */

    constructor() {
        const id = this.id = genUid()
        const element = this.element = document.createElement('IFRAME')
        element.className = 'd-none'
        element.src = `${XHR_JAIL_URL}?${id}`
        document.body.appendChild(element)
    }

    dispatchEvent(event) {
        this.element.contentWindow.dispatchEvent(event)
    }

    async doXhr(_method, url, body, headers) {
        const method = _method.toUpperCase()
        const eventId = genUid()

        const event = new CustomEvent('xhr', {detail: {eventId, method, url, body: JSON.stringify(body), headers}})
        ufsvIFrame.dispatchEvent(event)

        let resolve, reject
        const p = new Promise((_resolve, _reject) => { resolve = _resolve; reject = _reject; })

        function handler ({detail}) {
            if(detail.status >= 200 && detail.status <= 400){
                resolve(detail.payload)
            } else { reject(detail.payload) }
            document.removeEventListener(eventId, handler)
        }
        document.addEventListener(eventId, handler)

        const result = await p
        return result
    }
}

let ufsvIFrame
if(unfurlServerUrlOverride()) { ufsvIFrame = new UnfurlServerIFrame() }

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

export async function unfurlServerExport({format, branch, projectPath, includeDeployments}) {
    const baseUrl = unfurlServerUrlOverride() || DEFAULT_UNFURL_SERVER_URL
    const [lastCommitResult, password] = await Promise.all([fetchLastCommit(encodeURIComponent(projectPath), branch), fetchUserAccessToken()])
    const [latestCommit, _branch] = lastCommitResult

    if(!latestCommit) throw new Error('@unfurlServerExport: latestCommit is not defined')

    const username = window.gon.current_username

    let exportUrl = `${baseUrl}/export?format=${format}`

    const includePasswordInQuery = shouldEncodePasswordsInExportUrl()

    if(includePasswordInQuery && username && password) {
        exportUrl += `&username=${username}`
        exportUrl += `&password=${password}`
    }

    exportUrl += `&branch=${_branch}`
    exportUrl += `&auth_project=${encodeURIComponent(projectPath)}`

    if(alwaysSendLatestCommit() || !unfurlServerUrlOverride()) {
        exportUrl += `&latest_commit=${latestCommit}`
    }

    if(includeDeployments) {
        exportUrl += '&include_all_deployments=1'
    }

    return await doXhr('GET', exportUrl, null, createHeaders({includePasswordInQuery, username, password}))//await axios.get(exportUrl, createConfig({includePasswordInQuery, username, password}))
}

export async function unfurlServerUpdate({method, projectPath, branch, patch, commitMessage, variables}) {
    const baseUrl = unfurlServerUrlOverride() || DEFAULT_UNFURL_SERVER_URL
    const username = window.gon.current_username
    const [password, lastCommitResult] = await Promise.all([fetchUserAccessToken(), fetchLastCommit(encodeURIComponent(projectPath), branch)])
    const [latestCommit, _branch] = lastCommitResult

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

    const data = await doXhr('POST', url, body, headers)

    if(data.commit) {
        setLastCommit(encodeURIComponent(projectPath), branch, data.commit)
    } else {
        throw new Error('@unfurlServerUpdate: failed to set last commit')
    }
    return data
}
