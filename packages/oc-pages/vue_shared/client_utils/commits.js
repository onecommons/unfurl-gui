import axios from '~/lib/utils/axios_utils'

const DEFAULT_DELETE_MESSAGE = 'Delete deployment records'

function generateConfig(options) {
    if(options?.accessToken) {
        return {headers: {
            'PRIVATE-TOKEN': options.accessToken
        }}
    }
}
export async function deleteFiles(projectId, files, options) {
    const payload = {
        branch: options.branch || 'main',
        commit_message: options.commitMessage || DEFAULT_DELETE_MESSAGE,
        actions: files.map(file_path => ({
            file_path,
            action: 'delete'
        }))
    }

    const config = generateConfig(options)

    return await axios.post(`/api/v4/projects/${projectId}/repository/commits`, payload, config)?.data
}
