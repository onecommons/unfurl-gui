// Mock-only companion to unfurl-server.test.js (which also runs live): the
// /types fetch and its caches, export params from a repository url, and the
// developer-override path through the cross-origin iframe.

jest.mock('~/lib/utils/axios_utils', () => ({__esModule: true, default: {get: jest.fn(), post: jest.fn()}}))
jest.mock('./crossorigin-xhr', () => ({XhrIFrame: jest.fn()}))

// The module caches /types responses, the cloudmap combination and the health
// check in module scope, so each test loads its own copy.
let server, axios, XhrIFrame
beforeEach(() => {
    jest.isolateModules(() => {
        server = require('./unfurl-server')
        axios = require('~/lib/utils/axios_utils').default
        XhrIFrame = require('./crossorigin-xhr').XhrIFrame
    })
    sessionStorage.clear()
    localStorage.clear()
    Object.assign(window.gon, {unfurl_gui: true, current_username: 'tester'})
})

const urlsRequested = () => axios.get.mock.calls.map(([url]) => url)

describe('repoToExportParams', () => {
    it('reads the project path and branch from the url', () => {
        expect(server.repoToExportParams({url: 'https://gitlab.example/org/types.git#main'}))
            .toEqual({projectPath: 'org/types', branch: 'main'})
    })

    it('takes the file from the fragment, or from the entry when it has one', () => {
        expect(server.repoToExportParams({url: 'https://gitlab.example/org/types#main:a.yaml'}).file).toBe('a.yaml')
        expect(server.repoToExportParams({url: 'https://gitlab.example/org/types#main:a.yaml', file: 'b.yaml'}).file).toBe('b.yaml')
    })

    // `unfurl serve --gui` on a local project has no url to export through
    it.each(['', '/home/me/project'])('is null for %p', (url) => {
        expect(server.repoToExportParams({url})).toBeNull()
    })

    it('compares imports by what they export', () => {
        expect(server.importsAreEqual(
            {url: 'https://gitlab.example/org/types.git#main'},
            {url: 'https://gitlab.example/org/types#main'},
        )).toBe(true)
        expect(server.importsAreEqual(
            {url: 'https://gitlab.example/org/types#main'},
            {url: 'https://gitlab.example/org/types#dev'},
        )).toBe(false)
    })
})

describe('fetchTypeRepositories', () => {
    const typesFor = {
        'org/base': {
            ResourceType: {Compute: {name: 'Compute'}, Shared: {name: 'Shared', from: 'base'}},
            Overview: {categories: {compute: 'Compute'}},
        },
        'org/app': {
            // an incomplete type must not displace a complete one already seen
            ResourceType: {Shared: {name: 'Shared', _sourceinfo: {incomplete: true}}, App: {name: 'App', directives: ['substitute']}},
            ApplicationBlueprint: {bp: {primary: 'App'}},
            ResourceTemplate: {db: {name: 'db'}},
            DeploymentTemplate: {aws: {cloud: 'unfurl.relationships.ConnectsTo.AWSAccount', ResourceTemplate: {vm: {name: 'vm'}}}},
            Overview: {categories: {apps: 'Apps'}},
        },
    }

    beforeEach(() => {
        axios.get.mockImplementation(async url => {
            const project = decodeURIComponent(url.match(/auth_project=([^&]+)/)[1])
            return {data: typesFor[project]}
        })
    })

    const repositories = [
        {url: 'https://gitlab.example/org/base#main'},
        {url: 'https://gitlab.example/org/app#main', temp: true},
        {url: ''},
    ]

    it('merges every repository\'s types and categories', async () => {
        const {types, categories} = await server.fetchTypeRepositories(repositories)

        expect(Object.keys(types).sort()).toEqual(['App', 'Compute', 'Shared'])
        expect(types.Shared.from).toBe('base')
        expect(categories).toEqual({compute: 'Compute', apps: 'Apps'})
    })

    it('groups the templates a substitutable primary may copy', async () => {
        const {nestedTemplatesByPrimary} = await server.fetchTypeRepositories(repositories)

        expect(nestedTemplatesByPrimary).toEqual({App: {
            shared: {db: {name: 'db'}},
            local: {'unfurl.relationships.ConnectsTo.AWSAccount': {vm: {name: 'vm'}}},
        }})
    })

    it('asks for the cloudmap once, on the first repository', async () => {
        await server.fetchTypeRepositories(repositories)

        const withCloudmap = urlsRequested().filter(url => url.includes('cloudmap='))
        expect(withCloudmap).toEqual([expect.stringContaining('auth_project=org%2Fbase')])
        expect(withCloudmap[0]).toContain('cloudmap=onecommons/cloudmap')
    })

    it('fetches only temporary repositories with tempOnly', async () => {
        await server.fetchTypeRepositories(repositories, {tempOnly: true})
        expect(urlsRequested()).toEqual([expect.stringContaining('auth_project=org%2Fapp')])
    })

    it('reuses a response for the same project, branch and params', async () => {
        await server.fetchTypeRepositories(repositories)
        await server.fetchTypeRepositories(repositories)
        expect(axios.get).toHaveBeenCalledTimes(2)
    })

    it('passes implementation_requirements through and keys the cache by it', async () => {
        await server.fetchTypeRepositories(repositories.slice(0, 1), {implementation_requirements: ['a', 'b']})
        await server.fetchTypeRepositories(repositories.slice(0, 1), {implementation_requirements: 'c'})

        expect(urlsRequested()[0]).toContain('implementation_requirements=a&implementation_requirements=b')
        expect(urlsRequested()[1]).toContain('implementation_requirements=c')
    })
})

describe('credentials for /types', () => {
    beforeEach(() => {
        window.gon.unfurl_gui = false
        axios.get.mockImplementation(async url => {
            if(url == '/api/v4/unfurl_access_token') return {data: {token: 'tok'}}
            if(url.startsWith('/api/v4/projects/')) return {data: {visibility}}
            return {data: {ResourceType: {}}}
        })
    })
    let visibility
    const typesCall = () => axios.get.mock.calls.find(([url]) => url.includes('/types?'))

    it('sends credentials for a private project', async () => {
        visibility = 'private'
        await server.unfurlServerGetTypes({projectPath: 'org/private', branch: 'main'})
        expect(typesCall()[1].headers['x-git-credentials']).toBe(btoa('tester:tok'))
    })

    it('leaves them off for a public one', async () => {
        visibility = 'public'
        await server.unfurlServerGetTypes({projectPath: 'org/public', branch: 'main'})
        expect(typesCall()[1].headers['x-git-credentials']).toBeUndefined()
    })
})

describe('with a developer server override', () => {
    let iframeXhr
    beforeEach(() => {
        localStorage['unfurl-server-url'] = 'http://dev.example:5001'
        iframeXhr = jest.fn(async (method, url) => ({status: 200, data: url.includes('/health') ? {} : {ResourceType: {}}}))
        XhrIFrame.mockImplementation(() => ({ready: Promise.resolve(), doXhr: iframeXhr}))
    })

    it('goes through one cross-origin iframe, after a health check', async () => {
        await server.unfurlServerGetTypes({projectPath: 'org/a', branch: 'main'})
        await server.unfurlServerGetTypes({projectPath: 'org/b', branch: 'main'})

        expect(axios.get).not.toHaveBeenCalled()
        expect(XhrIFrame).toHaveBeenCalledTimes(1)
        expect(XhrIFrame).toHaveBeenCalledWith({rejectErrorCode: true})
        expect(iframeXhr.mock.calls.map(([method, url]) => `${method} ${url.split('?')[0]}`)).toEqual([
            'GET http://dev.example:5001/health',
            'GET http://dev.example:5001/types',
            'GET http://dev.example:5001/types',
        ])
        const [, url, body, headers] = iframeXhr.mock.calls[1]
        expect(url).toContain('auth_project=org%2Fa')
        expect(body).toBeNull()
        expect(headers).toEqual({})
    })

    it('remembers a passed health check across page loads', async () => {
        await server.healthCheckIfNeeded('org/a')
        expect(Object.keys(localStorage)).toContain('unfurl_gui:ufsv_dev:http://dev.example:5001:tester:org/a')

        jest.isolateModules(() => { server = require('./unfurl-server') })
        iframeXhr.mockClear()
        expect(server.healthCheckIfNeeded('org/a')).toBeUndefined()
        expect(iframeXhr).not.toHaveBeenCalled()
    })

    it('reports an unreachable server', async () => {
        iframeXhr.mockRejectedValue(new Error('Network Error'))
        await expect(server.unfurlServerGetTypes({projectPath: 'org/a', branch: 'main'}))
            .rejects.toThrow('Unable to reach Unfurl Server')
    })
})
