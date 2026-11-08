import axios from '~/lib/utils/axios_utils'

export async function postFormDataWithEntries(url: string, entries: Iterable<[string, string | Blob]>, headers?: Record<string, string>) {
    const formData = new FormData()
    for(const [key, value] of entries) {
        formData.append(key, value)
    }

    return await axios.post(url, formData, {headers})
}
