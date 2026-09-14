import axios from '~/lib/utils/axios_utils'
import {
    fetchProvider,
    saveProvider,
    deleteProvider,
    fetchAwsRole,
    gcpAuthorizeUrl,
    fetchGcpProjects,
} from './environment-providers'

jest.mock('~/lib/utils/axios_utils', () => ({
    __esModule: true,
    default: {get: jest.fn(), put: jest.fn(), delete: jest.fn()},
}))

const PROJECT_PATH = 'jest/dashboard'
const ENVIRONMENT = 'my-env'
const BASE = `/${PROJECT_PATH}/-/environments/${ENVIRONMENT}/provider`

function httpError(status, data) {
    const e = new Error(`Request failed with status code ${status}`)
    e.response = {status, data}
    return e
}

describe('environment providers client', () => {
    beforeEach(() => {
        window.gon = {}
    })

    describe('fetchProvider', () => {
        it('reads the environment\'s provider', async () => {
            axios.get.mockResolvedValue({data: {provider: 'aws', region: 'us-east-2'}})

            expect(await fetchProvider(PROJECT_PATH, ENVIRONMENT)).toEqual({provider: 'aws', region: 'us-east-2'})
            expect(axios.get).toHaveBeenCalledWith(BASE)
        })

        // 404 is "this environment has none" and 403 is "not yours to see"; both
        // mean the same thing to a caller deciding whether to offer setup
        it.each([404, 403])('resolves null on %i', async status => {
            axios.get.mockRejectedValue(httpError(status, {}))

            expect(await fetchProvider(PROJECT_PATH, ENVIRONMENT)).toBe(null)
        })

        it('does not call the fork endpoint standalone', async () => {
            window.gon = {unfurl_gui: true}

            expect(await fetchProvider(PROJECT_PATH, ENVIRONMENT)).toBe(null)
            expect(axios.get).not.toHaveBeenCalled()
        })
    })

    describe('saveProvider', () => {
        it('puts the provider and returns the saved row', async () => {
            axios.put.mockResolvedValue({data: {provider: 'gcp', zone: 'us-central1-a'}})
            const body = {provider: 'gcp', gcp_project_id: 'p', zone: 'us-central1-a'}

            expect(await saveProvider(PROJECT_PATH, ENVIRONMENT, body)).toEqual({provider: 'gcp', zone: 'us-central1-a'})
            expect(axios.put).toHaveBeenCalledWith(BASE, body)
        })

        it('surfaces a 422 message as the error message', async () => {
            axios.put.mockRejectedValue(httpError(422, {message: 'Access denied by AWS'}))

            await expect(saveProvider(PROJECT_PATH, ENVIRONMENT, {provider: 'aws'}))
                .rejects.toThrow('Access denied by AWS')
        })

        it('rethrows anything else untouched', async () => {
            axios.put.mockRejectedValue(httpError(500, {}))

            await expect(saveProvider(PROJECT_PATH, ENVIRONMENT, {provider: 'aws'}))
                .rejects.toThrow('Request failed with status code 500')
        })
    })

    describe('deleteProvider', () => {
        it('reports an environment that had none as not deleted', async () => {
            axios.delete.mockRejectedValue(httpError(404, {}))

            expect(await deleteProvider(PROJECT_PATH, ENVIRONMENT)).toBe(false)
        })

        it('is a no-op standalone', async () => {
            window.gon = {unfurl_gui: true}

            expect(await deleteProvider(PROJECT_PATH, ENVIRONMENT)).toBe(false)
            expect(axios.delete).not.toHaveBeenCalled()
        })
    })

    it('fetchAwsRole reads the account and external ids', async () => {
        axios.get.mockResolvedValue({data: {account_id: '1', external_id: '2', role_arn: null}})

        expect(await fetchAwsRole(PROJECT_PATH, ENVIRONMENT)).toEqual({account_id: '1', external_id: '2', role_arn: null})
        expect(axios.get).toHaveBeenCalledWith(`${BASE}/aws/role`)
    })

    it('fetchGcpProjects surfaces "not signed in" as a 422 message', async () => {
        axios.get.mockRejectedValue(httpError(422, {message: 'Google authorizations required'}))

        await expect(fetchGcpProjects(PROJECT_PATH, ENVIRONMENT)).rejects.toThrow('Google authorizations required')
    })

    it('gcpAuthorizeUrl encodes the return path', () => {
        const returnTo = `/${PROJECT_PATH}/-/environments/${ENVIRONMENT}?provider=gcp&signed_in=1`

        expect(gcpAuthorizeUrl(PROJECT_PATH, ENVIRONMENT, returnTo))
            .toBe(`${BASE}/gcp/authorize?return_to=${encodeURIComponent(returnTo)}`)
    })

    it('keeps a standalone home path from becoming a protocol-relative URL', () => {
        expect(gcpAuthorizeUrl('local:/dashboard', ENVIRONMENT, '/'))
            .toBe(`/-/environments/${ENVIRONMENT}/provider/gcp/authorize?return_to=%2F`)
    })
})
