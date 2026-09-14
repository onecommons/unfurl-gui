import axios from '~/lib/utils/axios_utils'
import {projectPathToHomeRoute} from './dashboard'

// The environment provider endpoints belong to the GitLab fork. Standalone has
// no equivalent, so reads answer "no provider" there instead of 404ing against
// unfurl's server -- the same runtime guard declareAvailableProviders uses.
function unavailable() {
    return !!window.gon.unfurl_gui
}

function providerPath(projectPath, environmentName) {
    return `${projectPathToHomeRoute(projectPath)}/-/environments/${encodeURIComponent(environmentName)}/provider`
}

// 422 is the only status carrying text worth showing: it is the provider's own
// refusal (STS declining the role, an expired Google token) relayed verbatim.
function providerError(e) {
    if(e.response?.status == 422 && e.response?.data?.message) {
        return new Error(e.response.data.message)
    }
    return e
}

function notAllowed(e) {
    return [403, 404].includes(e.response?.status)
}

export async function fetchProvider(projectPath, environmentName) {
    if(unavailable()) return null
    try {
        const {data} = await axios.get(providerPath(projectPath, environmentName))
        // an anonymous request is answered with a redirect to sign-in, which
        // axios follows and hands back as the login page with a 200
        return data?.provider? data: null
    } catch(e) {
        if(notAllowed(e)) return null
        throw providerError(e)
    }
}

export async function saveProvider(projectPath, environmentName, provider) {
    try {
        const {data} = await axios.put(providerPath(projectPath, environmentName), provider)
        return data
    } catch(e) {
        throw providerError(e)
    }
}

export async function deleteProvider(projectPath, environmentName) {
    if(unavailable()) return false
    try {
        await axios.delete(providerPath(projectPath, environmentName))
        return true
    } catch(e) {
        if(notAllowed(e)) return false
        throw providerError(e)
    }
}

// The instance's AWS account id plus this user's external id, both needed to
// write the trust policy on the role the user is about to create.
export async function fetchAwsRole(projectPath, environmentName) {
    try {
        const {data} = await axios.get(`${providerPath(projectPath, environmentName)}/aws/role`)
        return data
    } catch(e) {
        throw providerError(e)
    }
}

// A full navigation, not an XHR: the response is a redirect to Google's consent
// screen, and the token it yields lands in the Rails session.
export function gcpAuthorizeUrl(projectPath, environmentName, returnTo) {
    return `${providerPath(projectPath, environmentName)}/gcp/authorize?return_to=${encodeURIComponent(returnTo)}`
}

export async function fetchGcpProjects(projectPath, environmentName) {
    try {
        const {data} = await axios.get(`${providerPath(projectPath, environmentName)}/gcp/projects`)
        return data
    } catch(e) {
        throw providerError(e)
    }
}
