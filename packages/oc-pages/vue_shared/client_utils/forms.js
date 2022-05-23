import axios from '~/lib/utils/axios_utils'

export async function postFormDataWithEntries(url, entries) {
    const formData = new FormData()
    for(const [key, value] of entries) {
        formData.append(key, value)
    }

    axios.post(url, formData)
}
