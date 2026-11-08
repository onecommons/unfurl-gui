import axios from '~/lib/utils/axios_utils'
import graphqlClient from 'oc/graphql_shim'

jest.mock('~/lib/utils/axios_utils', () => ({
    __esModule: true,
    default: {get: jest.fn(), post: jest.fn()},
}))
jest.mock('~/lib/utils/csrf', () => ({__esModule: true, default: {token: 'csrf-token'}}))
jest.mock('oc/graphql_shim', () => ({__esModule: true, default: {query: jest.fn()}}))

// fetchUserAccessToken caches in module scope, so each test gets a fresh copy
let user
beforeEach(() => {
    jest.isolateModules(() => { user = require('./user') })
    window.gon = {}
})
afterEach(() => {
    axios.get.mockReset()
    axios.post.mockReset()
    graphqlClient.query.mockReset()
})

const membership = (integerValue, id, name) => ({
    accessLevel: {integerValue},
    project: {id: `gid://gitlab/Project/${id}`, fullPath: `org/${name}`, name},
})

describe('fetchUserProjects', () => {
    beforeEach(() => {
        graphqlClient.query.mockResolvedValue({data: {currentUser: {projectMemberships: {nodes: [
            membership(40, 1, 'app'),
            membership(20, 2, 'guest-only'),
            membership(50, 3, 'dashboard'),
        ]}}}})
    })

    it('keeps developer-or-better projects that are not dashboards, with numeric ids', async () => {
        axios.get.mockResolvedValue({data: [{name: 'dashboard'}]})
        await expect(user.fetchUserProjects()).resolves.toEqual([{id: 1, fullPath: 'org/app', name: 'app'}])
        expect(axios.get).toHaveBeenCalledWith('/api/v4/dashboards?min_access_level=40')
    })

    it('honours minimumAccessLevel', async () => {
        axios.get.mockResolvedValue({data: []})
        const projects = await user.fetchUserProjects({minimumAccessLevel: 10})
        expect(projects.map(p => p.name)).toEqual(['app', 'guest-only', 'dashboard'])
    })

    it('excludes nothing when the dashboards request fails', async () => {
        axios.get.mockRejectedValue(new Error('500'))
        const projects = await user.fetchUserProjects()
        expect(projects.map(p => p.name)).toEqual(['app', 'dashboard'])
    })

    it('is empty without a current user', async () => {
        graphqlClient.query.mockResolvedValue({data: {currentUser: null}})
        axios.get.mockResolvedValue({data: []})
        await expect(user.fetchUserProjects()).resolves.toEqual([])
    })
})

describe('fetchUserPublicEmail', () => {
    it('returns the public email', async () => {
        graphqlClient.query.mockResolvedValue({data: {currentUser: {publicEmail: 'me@example.com'}}})
        await expect(user.fetchUserPublicEmail()).resolves.toBe('me@example.com')
    })

    // GitLab answers "" when no public email is set
    it('is null for an empty email', async () => {
        graphqlClient.query.mockResolvedValue({data: {currentUser: {publicEmail: ''}}})
        await expect(user.fetchUserPublicEmail()).resolves.toBeNull()
    })
})

describe('generateAccessToken', () => {
    it('posts the token form and reads the new token from the page', async () => {
        axios.post.mockResolvedValue({data: '<input id="created-personal-access-token" value="glpat-new">'})

        await expect(user.generateAccessToken('ci token', {scopes: ['api'], expiresAt: '2027-01-01'})).resolves.toBe('glpat-new')

        const [url, body, config] = axios.post.mock.calls[0]
        expect(url).toBe('/-/profile/personal_access_tokens')
        expect(new URLSearchParams(body).getAll('personal_access_token[scopes][]')).toEqual(['api'])
        expect(Object.fromEntries(new URLSearchParams(body))).toMatchObject({
            authenticity_token: 'csrf-token',
            'personal_access_token[name]': 'ci token',
            'personal_access_token[expires_at]': '2027-01-01',
        })
        expect(config.headers['Content-Type']).toBe('application/x-www-form-urlencoded')
    })

    it('defaults to repository and registry read scopes', async () => {
        axios.post.mockResolvedValue({data: ''})
        await expect(user.generateAccessToken('t')).resolves.toBeUndefined()
        expect(new URLSearchParams(axios.post.mock.calls[0][1]).getAll('personal_access_token[scopes][]'))
            .toEqual(['read_repository', 'read_registry'])
    })
})

describe('fetchUserAccessToken', () => {
    it('is empty in standalone without a request', async () => {
        window.gon = {unfurl_gui: true}
        await expect(user.fetchUserAccessToken()).resolves.toBe('')
        expect(axios.get).not.toHaveBeenCalled()
    })

    it('fetches once and reuses the token', async () => {
        axios.get.mockResolvedValue({data: {token: 'tok'}})
        await expect(user.fetchUserAccessToken()).resolves.toBe('tok')
        await expect(user.fetchUserAccessToken()).resolves.toBe('tok')
        expect(axios.get).toHaveBeenCalledTimes(1)
        expect(axios.get).toHaveBeenCalledWith('/api/v4/unfurl_access_token')
    })

    it('is null when the request fails', async () => {
        axios.get.mockRejectedValue(new Error('403'))
        await expect(user.fetchUserAccessToken()).resolves.toBeNull()
    })
})

describe('fetchUser', () => {
    // jest does not run the `#!if` preprocessor, so this is the fork's path
    it('returns the current user', async () => {
        axios.get.mockResolvedValue({data: {username: 'me'}})
        await expect(user.fetchUser()).resolves.toEqual({username: 'me'})
        expect(axios.get).toHaveBeenCalledWith('/api/v4/user')
    })
})
