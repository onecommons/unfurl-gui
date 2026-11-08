import axios from '~/lib/utils/axios_utils'

interface Note {
    type: string | null
}

interface Discussion {
    notes: Note[]
}

export function countComments(discussions: Discussion[]) {
    let count = 0

    for(const item of discussions) {
        for(const note of item.notes) {
            if(note.type == 'DiscussionNote' || note.type === null) count++
        }
    }

    return count
}

export async function lookupNumberOfComments(commentsIssueUrl: string) {
    const discussions: Discussion[] = (await axios.get(`${commentsIssueUrl}/discussions.json`))?.data

    return countComments(discussions)
}
