import axios from '~/lib/utils/axios_utils'

export async function fetchRepositoryBranches(projectId) {
    return (await axios.get(`/api/v4/projects/${projectId}/repository/branches`))?.data
}

export async function fetchProjectInfo(projectId) {
    return (await axios.get(`/api/v4/projects/${projectId}`))?.data
}
