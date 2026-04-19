import axios from '~/lib/utils/axios_utils'
import { getOrFetchDefaultBranch } from './projects'

const DEFAULT_DELETE_MESSAGE = 'Delete deployment records'

function generateConfig(options) {
    if(options?.accessToken) {
        return {
            headers: { 'PRIVATE-TOKEN': options.accessToken, },
            validateStatus(_status) {
                return true
            }
        }
    }
}
export async function deleteFiles(projectId, files, options) {
    if(window.gon.unfurl_gui) throw new Error('Deleting files is unsupported in standalone mode.  You may need to delete them manually.')

    const payload = {
        branch: options.branch || await getOrFetchDefaultBranch(projectId),
        commit_message: options.commitMessage || DEFAULT_DELETE_MESSAGE,
        actions: files.map(file_path => ({
            file_path,
            action: 'delete'
        }))
    }

    const config = generateConfig(options)

    const response = await axios.post(`/api/v4/projects/${projectId}/repository/commits`, payload, config)

    if(response.status >= 400) {
        throw(new Error(response?.data?.message))
    }

    return response?.data
}
