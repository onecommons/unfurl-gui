import axios from '~/lib/utils/axios_utils'
import { fetchUserAccessToken } from './user';
import { fetchLastCommit, setLastCommit } from "./projects";
import {shouldEncodePasswordsInExportUrl} from '../storage-keys';

function createConfig({includePasswordInQuery, username, password}) {
    const config = {}
    const headers = {}

    if(!includePasswordInQuery && username && password) {
        headers['x-git-credentials'] = btoa(username + ':' + password)
    }

    config.headers = headers

    return config
}

export async function unfurlServerExport({baseUrl, format, branch, projectPath, includeDeployments}) {
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
    exportUrl += `&latest_commit=${latestCommit}`

    if(includeDeployments) {
        exportUrl += '&include_all_deployments=1'
    }

    const response = await axios.get(exportUrl, createConfig({includePasswordInQuery, username, password}))
    return response.data
}

export async function unfurlServerUpdate({baseUrl, method, projectPath, branch, patch, commitMessage, variables}) {
    const username = window.gon.current_username
    const password = await fetchUserAccessToken()

    const {data} = await axios.post(
        `${baseUrl}/${method}?auth_project=${encodeURIComponent(projectPath)}`,
        {
            ...variables,
            branch,
            patch,
            commitMessage
        },
        createConfig({username, password})
    )

    if(data.commit) {
        setLastCommit(encodeURIComponent(projectPath), branch, data.commit)
    } else {
        throw new Error('@unfurlServerUpdate: failed to set last commit')
    }
    return data
}
