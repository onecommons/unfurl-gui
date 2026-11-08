import axios from '~/lib/utils/axios_utils'
import { getOrFetchDefaultBranch } from './projects'

const DEFAULT_DELETE_MESSAGE = 'Delete deployment records'

interface DeleteOptions {
    branch?: string
    commitMessage?: string
    accessToken?: string
}

function generateConfig(options: DeleteOptions) {
    if(options?.accessToken) {
        return {
            headers: { 'PRIVATE-TOKEN': options.accessToken, },
            validateStatus(_status: number) {
                return true
            }
        }
    }
}
export async function deleteFiles(projectId: string | number, files: string[], options: DeleteOptions) {
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
