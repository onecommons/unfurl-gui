// The GitLab API half of projects.js. The commit tracking half (setLastCommit,
// fetchLastCommit, the queue) is covered by unfurl-server(-events).test.js.

jest.mock('~/lib/utils/axios_utils', () => ({__esModule: true, default: {get: jest.fn(), post: jest.fn(), put: jest.fn()}}))
jest.mock('oc/graphql_shim', () => ({__esModule: true, default: {query: jest.fn()}}))

// projectInfos and branchesData are module-scope caches
let projects, axios, graphqlClient
beforeEach(() => {
    jest.isolateModules(() => {
        projects = require('./projects')
        axios = require('~/lib/utils/axios_utils').default
        graphqlClient = require('oc/graphql_shim').default
    })
    sessionStorage.clear()
    localStorage.clear()
    window.gon = {}
})

const respond = (byUrl) => axios.get.mockImplementation(async (url) => {
    if(!(url in byUrl)) throw Object.assign(new Error(`unexpected ${url}`), {response: {status: 500}})
    const value = byUrl[url]
    if(value instanceof Error) throw value
    return {data: value}
})
const notFound = () => Object.assign(new Error('404'), {response: {status: 404}})

describe('fetchProjects', () => {
    it('lists maintained projects that are not dashboards', async () => {
        respond({
            '/api/v4/projects?min_access_level=40': [{path_with_namespace: 'org/app'}, {path_with_namespace: 'org/dashboard'}],
            '/api/v4/dashboards?min_access_level=10': [{path_with_namespace: 'org/dashboard'}],
        })
        await expect(projects.fetchProjects()).resolves.toEqual([{path_with_namespace: 'org/app'}])
    })

    it('takes a minimum access level and an access token', async () => {
        respond({'/api/v4/projects?min_access_level=30': [], '/api/v4/dashboards?min_access_level=10': []})
        await projects.fetchProjects({minAccessLevel: 30, accessToken: 'tok'})
        expect(axios.get.mock.calls[0][1]).toEqual({headers: {'PRIVATE-TOKEN': 'tok'}})
    })
})

describe('repository listings', () => {
    it('records the default branch from the branch list', async () => {
        respond({'/api/v4/projects/7/repository/branches?per_page=99999': [{name: 'dev'}, {name: 'main', default: true}]})
        await projects.fetchRepositoryBranches(7)
        expect(projects.getProjectDefaultBranch(7)).toBe('main')
    })

    it('fetches registry repositories', async () => {
        respond({'/api/v4/projects/7/registry/repositories?per_page=99999': [{id: 1}]})
        await expect(projects.fetchRegistryRepositories(7)).resolves.toEqual([{id: 1}])
    })

    it('picks the highest semver tag, ignoring the rest', async () => {
        respond({'/api/v4/projects/7/repository/tags?per_page=99999': [
            {name: 'v1.10.0'}, {name: 'latest'}, {name: 'v1.2.0'}, {name: 'v1.9.3'},
        ]})
        await expect(projects.fetchCurrentTag(7)).resolves.toEqual({name: 'v1.10.0'})
    })

    it('fetches pipelines, access tokens and a commit', async () => {
        respond({
            '/api/v4/projects/7/pipelines': [{id: 1}],
            '/api/v4/projects/7/access_tokens': [{id: 2}],
            '/api/v4/projects/7/repository/commits/abc': {id: 'abc'},
        })
        await expect(projects.fetchProjectPipelines(7)).resolves.toEqual([{id: 1}])
        await expect(projects.fetchProjectAccessTokens(7)).resolves.toEqual([{id: 2}])
        await expect(projects.fetchCommit(7, 'abc')).resolves.toEqual({id: 'abc'})
    })

    it('lists project files on the given or default branch', async () => {
        respond({
            '/org/app/-/files/dev?format=json': ['a'],
            '/api/v4/projects/org%2Fapp/repository/branches': [{name: 'main', default: true}],
            '/org/app/-/files/main?format=json': ['b'],
        })
        await expect(projects.listProjectFiles('org/app', {branch: 'dev'})).resolves.toEqual(['a'])
        await expect(projects.listProjectFiles('org/app')).resolves.toEqual(['b'])
    })
})

describe('fetchProjectInfo', () => {
    it('fetches once and records the default branch under both ids', async () => {
        respond({'/api/v4/projects/org%2Fapp': {id: 7, default_branch: 'main'}})

        await expect(projects.fetchProjectInfo('org%2Fapp')).resolves.toEqual({id: 7, default_branch: 'main'})
        await projects.fetchProjectInfo('org%2Fapp')

        expect(axios.get).toHaveBeenCalledTimes(1)
        expect(projects.getProjectDefaultBranch('org%2Fapp')).toBe('main')
        expect(projects.getProjectDefaultBranch(7)).toBe('main')
    })

    it('answers from the path alone in standalone', async () => {
        window.gon.unfurl_gui = true
        await expect(projects.fetchProjectInfo('org%2Fapp')).resolves.toEqual({name: 'app'})
        await expect(projects.fetchProjectInfo(7)).resolves.toBeNull()
        expect(axios.get).not.toHaveBeenCalled()
    })
})

describe('fetchBranches', () => {
    it('caches the list and takes a lone branch as the default', async () => {
        respond({'/api/v4/projects/7/repository/branches': [{name: 'trunk'}]})

        await projects.fetchBranches(7)
        await projects.fetchBranches(7)

        expect(axios.get).toHaveBeenCalledTimes(1)
        expect(projects.getProjectDefaultBranch(7)).toBe('trunk')
    })

    // a project created moments ago has no repository yet
    it('is empty for a project without a repository, and does not cache that', async () => {
        respond({'/api/v4/projects/7/repository/branches': notFound()})

        await expect(projects.fetchBranches(7)).resolves.toEqual([])
        await projects.fetchBranches(7)
        expect(axios.get).toHaveBeenCalledTimes(2)
    })

    it('rethrows anything else', async () => {
        respond({'/api/v4/projects/7/repository/branches': Object.assign(new Error('500'), {response: {status: 500}})})
        await expect(projects.fetchBranches(7)).rejects.toThrow('500')
    })

    it('resolves the default and current branch through it', async () => {
        respond({'/api/v4/projects/7/repository/branches': [{name: 'main', default: true}, {name: 'dev'}]})

        await expect(projects.getOrFetchDefaultBranch(7)).resolves.toBe('main')
        await expect(projects.getOrFetchCurrentBranch(7)).resolves.toBe('main')
        projects.setProjectCurrentBranch(7, 'dev')
        await expect(projects.getOrFetchCurrentBranch(7)).resolves.toBe('dev')
    })
})

describe('fetchQueueState', () => {
    it('returns the commits the server has queued against', async () => {
        respond({'/services/unfurl-server/queue_state?auth_project=org%2Fapp&branch=main': {commits: {abc: {queueid: 2}}}})
        await expect(projects.fetchQueueState('org/app', 'main')).resolves.toEqual({abc: {queueid: 2}})
    })

    // no read should fail for this
    it('is null when the request fails', async () => {
        respond({})
        await expect(projects.fetchQueueState('org/app', 'main')).resolves.toBeNull()
    })
})

describe('fetchBranch', () => {
    it('records the branch as default when it is', async () => {
        respond({'/api/v4/projects/7/repository/branches/main': {name: 'main', default: true}})
        await projects.fetchBranch(7, 'main')
        expect(projects.getProjectDefaultBranch(7)).toBe('main')
    })
})

describe('createBranch', () => {
    it('branches from the default and records the new commit', async () => {
        respond({'/api/v4/projects/org%2Fapp/repository/branches': [{name: 'main', default: true}]})
        axios.post.mockResolvedValue({status: 201, data: {name: 'feature', commit: {id: 'abc'}}})

        await expect(projects.createBranch('org%2Fapp', 'feature')).resolves.toEqual({name: 'feature', commit: {id: 'abc'}})
        expect(axios.post.mock.calls[0][1]).toEqual({branch: 'feature', ref: 'main'})
        expect(projects.getLastCommit('org/app', 'feature')).toMatchObject({commit: 'abc'})
    })

    it('uses the existing branch when it already exists', async () => {
        jest.spyOn(console, 'warn').mockImplementation(() => {})
        respond({'/api/v4/projects/org%2Fapp/repository/branches/feature': {name: 'feature', commit: {id: 'def'}}})
        axios.post.mockResolvedValue({status: 400, data: {message: 'Branch already exists'}})

        await projects.createBranch('org%2Fapp', 'feature', 'main')
        expect(projects.getLastCommit('org/app', 'feature')).toMatchObject({commit: 'def'})
        console.warn.mockRestore()
    })

    it('throws on any other failure', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => {})
        axios.post.mockResolvedValue({status: 403, data: {message: 'Forbidden'}})
        await expect(projects.createBranch('org%2Fapp', 'feature', 'main')).rejects.toThrow("Couldn't create branch 'feature'")
        console.error.mockRestore()
    })
})

describe('generateProjectAccessToken', () => {
    it('creates a read token that expires within the year', async () => {
        axios.post.mockResolvedValue({data: {token: 'glpat'}})

        await expect(projects.generateProjectAccessToken(7)).resolves.toBe('glpat')

        const [url, body] = axios.post.mock.calls[0]
        expect(url).toBe('/api/v4/projects/7/access_tokens')
        expect(body).toMatchObject({id: 7, name: 'DashboardProjectAccessToken', scopes: ['read_repository', 'read_registry']})
        const days = (new Date(body.expires_at) - Date.now()) / 864e5
        expect(days).toBeGreaterThan(362)
        expect(days).toBeLessThan(365)
    })

    it('takes overrides', async () => {
        axios.post.mockResolvedValue({data: {token: 't'}})
        await projects.generateProjectAccessToken(7, {name: 'ci', scopes: ['api']})
        expect(axios.post.mock.calls[0][1]).toMatchObject({name: 'ci', scopes: ['api']})
    })
})

describe('GraphQL lookups', () => {
    it('lists container repositories', async () => {
        graphqlClient.query.mockResolvedValue({data: {project: {containerRepositories: {nodes: [{name: 'app'}]}}}})
        await expect(projects.fetchContainerRepositories('org/app')).resolves.toEqual([{name: 'app'}])
        expect(graphqlClient.query.mock.calls[0][0].variables).toEqual({fullPath: 'org/app'})
    })

    it('is empty without a project', async () => {
        graphqlClient.query.mockResolvedValue({data: {project: null}})
        await expect(projects.fetchContainerRepositories('org/app')).resolves.toEqual([])
    })

    // jest does not run the `#!if` preprocessor, so this is the fork's path
    it('reads push permission', async () => {
        graphqlClient.query.mockResolvedValue({data: {project: {userPermissions: {pushCode: true}}}})
        await expect(projects.fetchUserHasWritePermissions('org/app')).resolves.toBe(true)
        graphqlClient.query.mockResolvedValue({data: {project: null}})
        await expect(projects.fetchUserHasWritePermissions('org/app')).resolves.toBe(false)
    })
})

describe('merge requests', () => {
    it('creates one, joining labels', async () => {
        axios.post.mockResolvedValue({data: {iid: 3}})
        await projects.createMergeRequest(7, {branch: 'f', target: 'main', title: 'T', description: 'D', labels: ['a', 'b']})
        expect(axios.post).toHaveBeenCalledWith('/api/v4/projects/7/merge_requests', {
            source_branch: 'f', target_branch: 'main', title: 'T', description: 'D', labels: 'a,b',
        })
    })

    it('leaves out an absent description and labels', async () => {
        axios.post.mockResolvedValue({data: {}})
        await projects.createMergeRequest(7, {branch: 'f', target: 'main', title: 'T'})
        expect(axios.post.mock.calls[0][1]).toEqual({source_branch: 'f', target_branch: 'main', title: 'T'})
    })

    it('lists by the given filters only', async () => {
        axios.get.mockResolvedValue({data: []})
        await projects.listMergeRequests(7, {branch: 'f', labels: 'x', state: 'opened'})
        expect(axios.get).toHaveBeenCalledWith('/api/v4/projects/7/merge_requests?source_branch=f&labels=x&state=opened')
    })

    it.each([
        [false, '[Draft] Add thing'],
        ['wip', '[Draft] Add thing'],
        [true, 'Add thing'],
    ])('sets the draft prefix for status %p', async (status, title) => {
        axios.get.mockResolvedValue({data: [{iid: 3, title: '[Draft] Add thing'}]})
        axios.put.mockResolvedValue({})

        await projects.setMergeRequestReadyStatus(7, {branch: 'f', target: 'main', status})

        expect(axios.get).toHaveBeenCalledWith('/api/v4/projects/7/merge_requests?source_branch=f&target_branch=main')
        expect(axios.put).toHaveBeenCalledWith('/api/v4/projects/7/merge_requests/3', {title})
    })
})
