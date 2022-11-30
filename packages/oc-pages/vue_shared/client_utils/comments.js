import axios from '~/lib/utils/axios_utils'

export function countComments(discussions) {
    let count = 0

    for(const item of discussions) {
        for(const note of item.notes) {
            if(note.type == 'DiscussionNote' || note.type === null) count++
        }
    }

    return count
}

export async function lookupNumberOfComments(commentsIssueUrl) {
    const discussions = (await axios.get(`${commentsIssueUrl}/discussions.json`))?.data

    return countComments(discussions)
}
