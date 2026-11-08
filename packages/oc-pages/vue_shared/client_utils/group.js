// @ts-check
import axios from '~/lib/utils/axios_utils'
/**
 * @param {string} tokenName
 * @param {string | number} groupId
 * @param {{scopes?: string[], expiresAt?: string}} [options]
 * @returns {Promise<string | undefined>}
 */
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
