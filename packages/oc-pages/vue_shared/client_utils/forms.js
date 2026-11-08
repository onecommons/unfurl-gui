// @ts-check
import axios from '~/lib/utils/axios_utils'

/**
 * @param {string} url
 * @param {Iterable<[string, string | Blob]>} entries
 * @param {Record<string, string>} [headers]
 */
export async function postFormDataWithEntries(url, entries, headers) {
    const formData = new FormData()
    for(const [key, value] of entries) {
        formData.append(key, value)
    }

    return await axios.post(url, formData, {headers})
}
