// @ts-check
import axios from '~/lib/utils/axios_utils'

/**
 * @typedef {{type: string | null}} Note
 * @typedef {{notes: Note[]}} Discussion
 */

/** @param {Discussion[]} discussions */
export function countComments(discussions) {
    let count = 0

    for(const item of discussions) {
        for(const note of item.notes) {
            if(note.type == 'DiscussionNote' || note.type === null) count++
        }
    }

    return count
}

/** @param {string} commentsIssueUrl */
export async function lookupNumberOfComments(commentsIssueUrl) {
    const discussions = (await axios.get(`${commentsIssueUrl}/discussions.json`))?.data

    return countComments(/** @type {Discussion[]} */ (discussions))
}
