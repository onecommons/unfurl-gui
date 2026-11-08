// environments.js beyond deleteEnvironment (environments-delete.test.js). The
// client modules it calls are mocked; the normalizer is real, since what
// fetchEnvironments returns is largely what that does to the export.

jest.mock('~/lib/utils/axios_utils', () => ({
    __esModule: true,
    default: {get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn()},
}))
jest.mock('oc/graphql_shim', () => ({__esModule: true, default: {query: jest.fn()}}))
jest.mock('./envvars', () => ({
    patchEnv: jest.fn(),
    tryFetchEnvironmentVariables: jest.fn(),
    deleteEnvironmentVariables: jest.fn(),
}))
jest.mock('./forms', () => ({postFormDataWithEntries: jest.fn()}))
jest.mock('./unfurl-server', () => ({
    unfurlServerUpdate: jest.fn(),
    unfurlServerExport: jest.fn(),
    fetchTypeRepositories: jest.fn(),
}))
jest.mock('./projects', () => ({
    getOrFetchCurrentBranch: jest.fn(async () => 'main'),
    fetchLastCommit: jest.fn(async () => ['abc', 'main', 0, false]),
}))

// gitlabProjectEnvironments and fetchDashboardProviders cache per project
let envs, axios, graphqlClient, envvars, forms, server, projects
beforeEach(() => {
    jest.isolateModules(() => {
        envs = require('./environments')
        axios = require('~/lib/utils/axios_utils').default
        graphqlClient = require('oc/graphql_shim').default
        envvars = require('./envvars')
        forms = require('./forms')
        server = require('./unfurl-server')
        projects = require('./projects')
    })
    window.gon = {}
    sessionStorage.clear()
})

describe('GitLab environment lookups', () => {
    it('lists the environments page', async () => {
        axios.get.mockResolvedValue({data: {environments: [{name: 'prod'}]}})
        await expect(envs.fetchGitlabEnvironments('org/dash')).resolves.toEqual([{name: 'prod'}])
        expect(axios.get).toHaveBeenCalledWith('/org/dash/-/environments.json')
    })

    it('finds an environment id by exact name', async () => {
        axios.get.mockResolvedValue({data: [{name: 'prod-2', id: 2}, {name: 'prod', id: 1}]})
        await expect(envs.lookupEnvironmentId('org/dash', 'prod')).resolves.toBe(1)
        expect(axios.get).toHaveBeenCalledWith('/api/v4/projects/org%2Fdash/environments', {params: {name: 'prod'}})
    })

    it('is -1 for no match', async () => {
        axios.get.mockResolvedValue({data: []})
        await expect(envs.lookupEnvironmentId('org/dash', 'prod')).resolves.toBe(-1)
    })

    it('caches the project environment list for gitlabEnvironmentId', async () => {
        axios.get.mockResolvedValue({data: [{name: 'prod', id: 5}]})
        await expect(envs.gitlabEnvironmentId('org/dash', 'prod')).resolves.toBe(5)
        await expect(envs.gitlabEnvironmentId('org/dash', 'other')).resolves.toBeUndefined()
        expect(axios.get).toHaveBeenCalledTimes(1)
    })
})

describe('shareEnvironmentVariables', () => {
    beforeEach(() => {
        envvars.tryFetchEnvironmentVariables.mockResolvedValue([
            {id: 1, key: 'TOKEN', value: 't', environment_scope: 'source'},
            {id: 2, key: 'OTHER', value: 'o', environment_scope: 'source'},
            {id: 3, key: 'TOKEN', value: 'x', environment_scope: 'elsewhere'},
        ])
        envvars.patchEnv.mockImplementation(async patch => patch)
    })

    it('copies the named variables into the target scope under a prefix', async () => {
        const result = await envs.shareEnvironmentVariables('org/dash', 'source', 'target', ['TOKEN'], 'p')

        expect(result.prefix).toBe('p')
        expect(result.transferredVariables).toEqual(['TOKEN'])
        expect(result.patch).toEqual({p__TOKEN: {key: 'p__TOKEN', value: 't', environment_scope: 'target'}})
        expect(envvars.patchEnv).toHaveBeenCalledWith(expect.any(Object), 'target', 'org/dash', 0)
    })

    it('uses no prefix for an empty one, and applies substitutions', async () => {
        const {patch} = await envs.shareEnvironmentVariables('org/dash', 'source', 'target', ['TOKEN'], '', [[/TOK/, 'KEY']])
        expect(Object.keys(patch)).toEqual(['KEYEN'])
    })

    it('generates a prefix by default', async () => {
        const {prefix} = await envs.shareEnvironmentVariables('org/dash', 'source', 'target', ['TOKEN'])
        expect(prefix).toMatch(/^_[0-9a-z]+$/)
    })
})

describe('deleteEnvironmentByName', () => {
    it('stops and deletes through the paths the environments page gives', async () => {
        axios.get.mockResolvedValue({data: {environments: [{name: 'prod', stop_path: '/stop', delete_path: '/delete'}]}})
        jest.spyOn(console, 'warn').mockImplementation(() => {})

        await expect(envs.deleteEnvironmentByName('org/dash', 'prod')).resolves.toBe(true)

        expect(envvars.deleteEnvironmentVariables).toHaveBeenCalledWith('prod', 'org/dash')
        expect(axios.post).toHaveBeenCalledWith('/stop')
        expect(axios.delete).toHaveBeenCalledWith('/delete')
        console.warn.mockRestore()
    })

    it('only drops the variables when the environment is not listed', async () => {
        axios.get.mockResolvedValue({data: {environments: []}})
        await expect(envs.deleteEnvironmentByName('org/dash', 'prod')).resolves.toBe(false)
        expect(envvars.deleteEnvironmentVariables).toHaveBeenCalled()
        expect(axios.post).not.toHaveBeenCalled()
    })
})

describe('initUnfurlEnvironment', () => {
    it('creates the environment on the current branch, with import sources', async () => {
        const environment = {
            name: 'do',
            primary_provider: {name: 'primary_provider', type: 'unfurl.relationships.ConnectsTo.DigitalOceanEnvironment'.replace('unfurl.relationships.', '')},
            instances: {ingress: {name: 'ingress', type: 'KubernetesIngressController@unfurl.cloud/onecommons/std'}},
        }

        const created = await envs.initUnfurlEnvironment('org/dash', environment)

        expect(projects.getOrFetchCurrentBranch).toHaveBeenCalledWith('org%2Fdash')
        expect(created.connections).toEqual({primary_provider: environment.primary_provider})
        expect(created.__typename).toBe('DeploymentEnvironment')
        expect(environment.primary_provider._sourceinfo.file).toBe('digitalocean/compute.yaml')
        expect(environment.instances.ingress._sourceinfo.file).toBe('k8s.py')

        expect(server.unfurlServerUpdate).toHaveBeenCalledWith(expect.objectContaining({
            projectPath: 'org/dash', method: 'update_environment', branch: 'main', patch: [created],
        }))
    })

    it('has no connections without a primary provider, and creates a provider for a deployment path', async () => {
        const created = await envs.initUnfurlEnvironment('org/dash', {name: 'empty'}, {deployment_path: 'environments/x'})
        expect(created).toMatchObject({connections: {}, instances: {}})
        expect(server.unfurlServerUpdate.mock.calls[0][0]).toMatchObject({
            method: 'create_provider', variables: {deployment_path: 'environments/x'},
        })
    })
})

describe('postGitlabEnvironmentForm', () => {
    beforeEach(() => {
        sessionStorage.environmentFormEntries = JSON.stringify([['environment[name]', 'prod']])
        sessionStorage.environmentFormAction = '/org/dash/-/environments'
    })

    it('posts the stored form', async () => {
        forms.postFormDataWithEntries.mockResolvedValue({status: 200})
        await expect(envs.postGitlabEnvironmentForm()).resolves.toEqual({status: 200})
        expect(forms.postFormDataWithEntries).toHaveBeenCalledWith('/org/dash/-/environments', [['environment[name]', 'prod']])
    })

    it('wraps a failure', async () => {
        forms.postFormDataWithEntries.mockRejectedValue(new Error('422'))
        await expect(envs.postGitlabEnvironmentForm()).rejects.toThrow('Failed to create dashboard environment: 422')
    })
})

describe('connectionsToArray', () => {
    it('turns numerically keyed connections and instances into arrays, dropping named keys', () => {
        const env = {connections: {0: 'a', primary_provider: 'p', 1: 'b'}, instances: {0: 'i', ingress: 'x'}}
        expect(envs.connectionsToArray(env)).toEqual({connections: ['a', 'b'], instances: ['i']})
    })

    it('passes an array through', () => {
        const list = [1]
        expect(envs.connectionsToArray(list)).toBe(list)
    })
})

describe('fetchEnvironments', () => {
    const exportWith = (overrides = {}) => ({
        DeploymentEnvironment: {
            defaults: {name: 'defaults', instances: {}},
            prod: {name: 'prod', instances: {db: {metadata: {title: 'Database'}}, cache: {}}},
            broken: {name: 'broken', error: 'bad yaml'},
        },
        DeploymentPath: {'environments/prod/app': {name: 'environments/prod/app', environment: 'prod'}},
        ResourceType: {Compute: {name: 'Compute'}},
        deployments: [{
            Deployment: {app: {name: 'app', title: 'App'}},
            ResourceType: {Local: {name: 'Local'}},
        }],
        ...overrides,
    })

    it('exports environments with deployments at a fresh commit', async () => {
        server.unfurlServerExport.mockResolvedValue(exportWith())

        const result = await envs.fetchEnvironments({fullPath: 'org/dash', branch: 'main'})

        expect(server.unfurlServerExport).toHaveBeenCalledWith(expect.objectContaining({
            format: 'environments', projectPath: 'org/dash', includeDeployments: true, branch: 'main',
        }))
        expect(projects.fetchLastCommit).toHaveBeenCalledWith('org/dash', 'main')

        expect(result.environments.map(e => e.name)).toEqual(['prod'])
        expect(result.environments[0]._dashboard).toBe('org/dash')
        expect(result.environments[0].instances).toEqual({
            db: {metadata: {title: 'Database'}, title: 'Database', name: 'db'},
            cache: {title: 'cache', name: 'cache'},
        })
        expect(result.defaults.name).toBe('defaults')
        expect(result.deploymentPaths).toHaveLength(1)
        expect(result.ResourceType.Compute.__typename).toBe('ResourceType')

        expect(result.deployments).toHaveLength(1)
        expect(result.deployments[0]._environment).toBe('prod')
        expect(result.deployments[0].Deployment.app.__typename).toBe('Deployment')
        expect(result.deployments[0].ResourceType.Local.__typename).toBe('ResourceType')

        expect(result.errors).toEqual([expect.objectContaining({
            message: 'Load environments: An error occurred during an environment export',
            context: {name: 'broken', error: 'bad yaml'},
        })])
    })

    it('leaves deployments out when not asked for', async () => {
        server.unfurlServerExport.mockResolvedValue(exportWith())
        const result = await envs.fetchEnvironments({fullPath: 'org/dash', includeDeployments: false, only: 'prod'})
        expect(result.deployments).toBeUndefined()
        expect(server.unfurlServerExport.mock.calls[0][0]).toMatchObject({includeDeployments: false, environment: 'prod'})
    })

    it('reports deployments that failed to export, or have an unexpected shape', async () => {
        server.unfurlServerExport.mockResolvedValue(exportWith({deployments: [
            {deployment: 'environments/prod/bad', error: 'boom'},
            {Deployment: {orphan: {name: 'orphan', title: 'Orphan'}}},
        ]}))

        const {errors} = await envs.fetchEnvironments({fullPath: 'org/dash'})

        const report = errors.find(e => e.message.startsWith('2 errors occurred while fetching deployments.'))
        expect(report.message).toBe('2 errors occurred while fetching deployments. Unable to display bad, Orphan due to errors.')
        expect(report.context[0]).toMatchObject({deployment: 'environments/prod/bad', error: 'boom'})
        expect(report.context[1]).toMatchObject({deployment: 'Orphan', detail: 'Unexpected shape for deployment'})
    })

    it('flags a deployment the obsolete filter removes', async () => {
        server.unfurlServerExport.mockResolvedValue(exportWith({deployments: [
            {ApplicationBlueprint: {'generic-cloud-provider-implementations': {}}, Deployment: {}},
        ]}))
        const result = await envs.fetchEnvironments({fullPath: 'org/dash'})
        expect(result.deployments).toEqual([])
        expect(result.errors.map(e => e.message)).toContain('Assertion failed: An obsolete filter removed a deployment')
    })

    it('turns a failed export into a critical error carrying the response body', async () => {
        server.unfurlServerExport.mockRejectedValue(Object.assign(new Error('500 error'), {response: {data: {code: 'X'}}}))

        const result = await envs.fetchEnvironments({fullPath: 'org/dash', branch: 'main'})

        expect(result.environments).toEqual([])
        expect(result.errors).toEqual([expect.objectContaining({
            severity: 'critical',
            message: 'Load environments: An error occurred during an export request (500 error)',
            context: expect.objectContaining({error: '500 error', projectPath: 'org/dash', code: 'X'}),
        })])
    })

    it('turns a malformed export into a critical error instead of throwing', async () => {
        server.unfurlServerExport.mockResolvedValue({DeploymentEnvironment: null})
        const result = await envs.fetchEnvironments({fullPath: 'org/dash'})
        expect(result.environments).toEqual([])
        expect(result.errors[0]).toMatchObject({severity: 'critical', context: expect.objectContaining({topKeys: ['DeploymentEnvironment']})})
    })
})

describe('declareAvailableProviders', () => {
    it('records the providers on the GitLab environment', async () => {
        axios.get.mockResolvedValue({data: [{name: 'prod', id: 5}]})
        axios.put.mockResolvedValue({})

        await envs.declareAvailableProviders('org/dash', 'prod', [
            'unfurl.relationships.ConnectsTo.AWSAccount', 'unfurl.relationships.ConnectsTo.AWSAccount@x',
        ])

        const [url, body] = axios.put.mock.calls[0]
        expect(url).toBe('/api/v4/projects/org%2Fdash/environments/5')
        expect(decodeURIComponent(new URL(body.external_url).pathname.slice(1)).split(',')).toHaveLength(1)
    })

    it('does nothing in standalone', async () => {
        window.gon.unfurl_gui = true
        await envs.declareAvailableProviders('org/dash', 'prod', ['anything'])
        expect(axios.get).not.toHaveBeenCalled()
    })

    it('refuses unknown provider types', async () => {
        await expect(envs.declareAvailableProviders('org/dash', 'prod', ['NotAProvider']))
            .rejects.toThrow('unknown provider types')
    })

    it('refuses an environment it cannot find', async () => {
        axios.get.mockResolvedValue({data: []})
        await expect(envs.declareAvailableProviders('org/dash', 'prod', ['unfurl.relationships.ConnectsTo.AWSAccount']))
            .rejects.toThrow('could not lookup environment ID for prod')
    })
})

describe('provider dashboards', () => {
    const encoded = providers => `http://localhost/${encodeURIComponent(providers.join(','))}`
    const project = (fullPath, accessLevel, environments) => ({
        fullPath,
        projectMembers: {nodes: [{accessLevel: {integerValue: accessLevel}}]},
        environments: {nodes: environments},
    })

    it('lists dashboards the user can reach, with providers per environment', async () => {
        window.gon.current_username = 'me'
        graphqlClient.query.mockResolvedValue({data: {currentUser: {projectMemberships: {nodes: [
            {project: project('org/a', 40, [{name: 'prod', externalUrl: encoded(['aws', 'gcp'])}, {name: 'bare', externalUrl: null}])},
            {project: project('org/b', 10, [])},
        ]}}}})

        const dashboards = await envs.fetchAvailableProviderDashboards(30)

        expect(graphqlClient.query.mock.calls[0][0].variables).toEqual({username: 'me'})
        expect(dashboards.map(d => d.fullPath)).toEqual(['org/a'])
        expect(dashboards[0].providersByEnvironment).toEqual({prod: ['aws', 'gcp'], bare: null})
        expect(dashboards[0].primaryProviderFor('prod')).toBe('aws')
        expect(dashboards[0].primaryProviderFor('missing')).toBeNull()
    })

    it('throws when the memberships cannot be read', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => {})
        graphqlClient.query.mockResolvedValue({data: {currentUser: null}})
        await expect(envs.fetchAvailableProviderDashboards()).rejects.toThrow('could not read list of providers')
        console.error.mockRestore()
    })

    it('fetches one dashboard\'s providers once', async () => {
        graphqlClient.query.mockResolvedValue({data: {project: {fullPath: 'org/a', environments: {nodes: [{name: 'prod', externalUrl: encoded(['aws'])}]}}}})

        const providers = await envs.fetchDashboardProviders('org/a')
        await envs.fetchDashboardProviders('org/a')

        expect(graphqlClient.query).toHaveBeenCalledTimes(1)
        expect(providers.providersByEnvironment).toEqual({prod: ['aws']})
    })

    it('has no dashboard providers in standalone, or for a missing project', async () => {
        window.gon.unfurl_gui = true
        await expect(envs.fetchDashboardProviders('org/a')).resolves.toBeNull()
        window.gon.unfurl_gui = false
        graphqlClient.query.mockResolvedValue({data: {project: null}})
        await expect(envs.fetchDashboardProviders('org/b')).resolves.toBeNull()
    })

    it('throws on GraphQL errors', async () => {
        graphqlClient.query.mockResolvedValue({data: null, errors: [{message: 'nope'}]})
        await expect(envs.fetchDashboardProviders('org/c')).rejects.toThrow('Load cloud providers:')
    })
})
