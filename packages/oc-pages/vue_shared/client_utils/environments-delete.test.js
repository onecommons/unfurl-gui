import axios from '~/lib/utils/axios_utils'
import {deleteEnvironment, lookupEnvironmentId} from './environments'
import {deleteEnvironmentVariables} from './envvars'

jest.mock('~/lib/utils/axios_utils', () => ({
    __esModule: true,
    default: {get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn()},
}))
jest.mock('./envvars', () => ({
    __esModule: true,
    deleteEnvironmentVariables: jest.fn(),
    patchEnv: jest.fn(),
    tryFetchEnvironmentVariables: jest.fn(),
}))

const PROJECT_PATH = 'jest/dashboard'
const ENCODED = encodeURIComponent(PROJECT_PATH)

/*
 * The dashboard is an SPA and #js-table-component's dataset is rendered once,
 * from whichever environment (if any) the request was for. deleteEnvironment
 * used to take that id -- gon.environmentId -- while taking the *name* from the
 * route, so the two could disagree: land on one environment, route to another,
 * delete, and the wrong environment was stopped and destroyed.
 */
describe('deleteEnvironment', () => {
    beforeEach(() => {
        window.gon = {}
        axios.get.mockResolvedValue({data: []})
        axios.post.mockResolvedValue({})
        axios.delete.mockResolvedValue({})
        deleteEnvironmentVariables.mockResolvedValue()
    })

    it('deletes the environment it was given, not the one in the dataset', async () => {
        // what the page was rendered for
        window.gon.environmentId = 111
        // what the user actually routed to and deleted
        axios.get.mockResolvedValue({data: [{name: 'env-b', id: 222}]})

        await deleteEnvironment(PROJECT_PATH, 'env-b')

        expect(axios.delete).toHaveBeenCalledWith(`/api/v4/projects/${ENCODED}/environments/222`)
        expect(axios.post).toHaveBeenCalledWith(`/${PROJECT_PATH}/-/environments/222/stop`)
        expect(axios.delete).not.toHaveBeenCalledWith(expect.stringContaining('/111'))
    })

    it('looks the id up by exact name across every state', async () => {
        axios.get.mockResolvedValue({data: [{name: 'env-b', id: 222}]})

        await deleteEnvironment(PROJECT_PATH, 'env-b')

        // no `states` filter: /-/environments.json serves ACTIVE_STATES only, so
        // an already-stopped environment would be missing from it
        expect(axios.get).toHaveBeenCalledWith(
            `/api/v4/projects/${ENCODED}/environments`,
            {params: {name: 'env-b'}},
        )
    })

    // The name is the caller's, so a project id from the dataset could disagree
    // with it just as the environment id did.
    it('addresses the project by path rather than a dataset id', async () => {
        window.gon.projectId = 9999
        axios.get.mockResolvedValue({data: [{name: 'env-b', id: 222}]})

        await deleteEnvironment(PROJECT_PATH, 'env-b')

        expect(axios.delete).not.toHaveBeenCalledWith(expect.stringContaining('9999'))
    })

    it('deletes the environment\'s variables too', async () => {
        axios.get.mockResolvedValue({data: [{name: 'env-b', id: 222}]})

        await deleteEnvironment(PROJECT_PATH, 'env-b')

        expect(deleteEnvironmentVariables).toHaveBeenCalledWith('env-b', PROJECT_PATH)
    })

    // Previously an unresolvable id produced DELETE .../environments/undefined,
    // which 404s while the caller goes on to flash "deleted successfully".
    it('refuses to delete when the name matches nothing', async () => {
        axios.get.mockResolvedValue({data: []})

        await expect(deleteEnvironment(PROJECT_PATH, 'env-b')).rejects.toThrow(/env-b/)
        expect(axios.delete).not.toHaveBeenCalled()
        expect(axios.post).not.toHaveBeenCalled()
    })

    // The id is resolved first for this reason: a refusal has to leave the
    // environment intact, and its variables are the part that cannot come back.
    it('leaves the variables alone when it refuses', async () => {
        axios.get.mockResolvedValue({data: []})

        await expect(deleteEnvironment(PROJECT_PATH, 'env-b')).rejects.toThrow()
        expect(deleteEnvironmentVariables).not.toHaveBeenCalled()
    })

    it('does not settle for a near-miss on the name', async () => {
        axios.get.mockResolvedValue({data: [{name: 'env-b-staging', id: 333}]})

        await expect(deleteEnvironment(PROJECT_PATH, 'env-b')).rejects.toThrow()
        expect(axios.delete).not.toHaveBeenCalled()
    })
})

describe('lookupEnvironmentId', () => {
    beforeEach(() => {
        window.gon = {}
        axios.get.mockResolvedValue({data: []})
    })

    it('resolves the id for an exact name match', async () => {
        axios.get.mockResolvedValue({data: [{name: 'prod', id: 12}]})
        expect(await lookupEnvironmentId(PROJECT_PATH, 'prod')).toBe(12)
    })

    it('answers -1 rather than undefined when there is no match', async () => {
        expect(await lookupEnvironmentId(PROJECT_PATH, 'prod')).toBe(-1)
    })
})
