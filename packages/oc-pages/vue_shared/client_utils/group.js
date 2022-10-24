import axios from '~/lib/utils/axios_utils'
export async function generateGroupAccessToken(tokenName, groupId, options) {
    const {scopes, expiresAt} = Object.assign({
        scopes: ['read_registry', 'read_repository'],
        expiresAt: ''
    }, options)

    return (await axios.post(
        `/api/v4/groups/${encodeURIComponent(groupId)}/access_tokens`,
        {
            id: groupId,
            name: tokenName,
            scopes,
            access_level: 40,
            expires_at: expiresAt
        }
    ))?.data?.token
}
