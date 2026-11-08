import axios from '~/lib/utils/axios_utils'
import {prepareVariables, triggerAtomicDeployment} from 'oc_vue_shared/client_utils/pipelines'
import {awaitQueuedWrite, fetchTypeRepositories} from 'oc_vue_shared/client_utils/unfurl-server'
import {patchEnv, fetchEnvironmentVariables} from 'oc_vue_shared/client_utils/envvars'
import {fetchProjectInfo, generateProjectAccessToken, getOrFetchCurrentBranch} from 'oc_vue_shared/client_utils/projects'
import {fetchEnvironments, shareEnvironmentVariables, fetchDashboardProviders} from 'oc_vue_shared/client_utils/environments'
import {deleteFiles} from 'oc_vue_shared/client_utils/commits'
import environmentsStore from './environments'

jest.mock('~/lib/utils/axios_utils', () => ({__esModule: true, default: {get: jest.fn()}}))
jest.mock('oc_vue_shared/client_utils/pipelines', () => ({prepareVariables: jest.fn(), triggerAtomicDeployment: jest.fn()}))
jest.mock('oc_vue_shared/client_utils/unfurl-server', () => ({
    awaitQueuedWrite: jest.fn(), fetchTypeRepositories: jest.fn(), importsAreEqual: jest.fn(),
}))
jest.mock('oc_vue_shared/client_utils/envvars', () => ({
    ...jest.requireActual('oc_vue_shared/client_utils/envvars'),
    patchEnv: jest.fn(), fetchEnvironmentVariables: jest.fn(),
}))
jest.mock('oc_vue_shared/client_utils/projects', () => ({
    fetchProjectInfo: jest.fn(), generateProjectAccessToken: jest.fn(), getOrFetchCurrentBranch: jest.fn(),
}))
jest.mock('oc_vue_shared/client_utils/environments', () => ({
    fetchEnvironments: jest.fn(), shareEnvironmentVariables: jest.fn(), fetchDashboardProviders: jest.fn(),
}))
jest.mock('oc_vue_shared/client_utils/commits', () => ({deleteFiles: jest.fn()}))

const {mutations, actions} = environmentsStore

function gettersOf(state, rootGetters = {}) {
    const g = {}
    for(const [name, fn] of Object.entries(environmentsStore.getters)) {
        Object.defineProperty(g, name, {get: () => fn(state, g, {}, rootGetters), enumerable: true})
    }
    return g
}

// commit/dispatch recording everything, applying this module's own mutations
// and running its own actions
function context(state = environmentsStore.state(), rootGetters = {}, rootActions = {}) {
    const ctx = {state, rootGetters, getters: gettersOf(state, rootGetters)}
    ctx.commit = jest.fn((name, payload) => mutations[name]?.(state, payload))
    ctx.dispatch = jest.fn(async (name, payload) => {
        if(name in rootActions) return rootActions[name](payload)
        return actions[name]?.(ctx, payload)
    })
    return ctx
}
const committed = (ctx, name) => ctx.commit.mock.calls.filter(([n]) => n == name).map(([, payload]) => payload)

const environment = (name, extra = {}) => ({
    name,
    connections: {primary_provider: {name: 'primary_provider', type: 'unfurl.relationships.ConnectsTo.AWSAccount'}},
    instances: {dns: {name: 'dns', type: 'DNSZone'}},
    repositories: {std: {url: 'https://unfurl.cloud/onecommons/std.git'}},
    ...extra,
})

beforeEach(() => { window.gon = {current_username: 'me'} })

describe('mutations', () => {
    it('tracks repository dependencies, hooks and environments', () => {
        const state = environmentsStore.state()
        mutations.addRepositoryDependencies(state, ['a'])
        mutations.addRepositoryDependencies(state, ['b'])
        expect(state.repositoryDeploymentDependencies).toEqual(['a', 'b'])
        mutations.clearRepositoryDependencies(state)
        expect(state.repositoryDeploymentDependencies).toEqual([])

        const hook = () => true
        mutations.onSaveEnvironment(state, hook)
        expect(state.saveEnvironmentHooks).toEqual([hook])
        mutations.clearSaveEnvironmentHooks(state)
        expect(state.saveEnvironmentHooks).toEqual([])

        mutations.setProjectEnvironments(state, [environment('prod'), environment('dev')])
        mutations.addProjectEnvironment(state, {name: 'prod', fresh: true})
        expect(state.projectEnvironments.map(e => e.name)).toEqual(['dev', 'prod'])
        expect(state.projectEnvironments[1].fresh).toBe(true)
        mutations.discardEnvironment(state, 'dev')
        expect(state.projectEnvironments.map(e => e.name)).toEqual(['prod'])
    })

    it('tracks the upstream of a deployment, clearing it all at once', () => {
        const state = environmentsStore.state()
        mutations.setUpstreamCommit(state, 'abc')
        mutations.setUpstreamId(state, 9)
        mutations.setUpstreamProject(state, {id: 7})
        mutations.setUpstreamBranch(state, 'main')
        expect(state).toMatchObject({upstreamCommit: 'abc', upstreamId: 9, upstreamProject: 7, upstreamBranch: 'main'})
        mutations.clearUpstream(state)
        expect(state).toMatchObject({upstreamCommit: null, upstreamId: null, upstreamProject: null, upstreamBranch: null})
    })

    it('sets one variable without dropping the others', () => {
        const state = environmentsStore.state()
        mutations.setVariablesByEnvironment(state, {prod: {A: '1'}})
        mutations.setVariableByEnvironment(state, {environmentName: 'prod', variableName: 'B', variableValue: '2'})
        mutations.setVariableByEnvironment(state, {environmentName: 'dev', variableName: 'C', variableValue: '3'})
        expect(state.variablesByEnvironment).toEqual({prod: {A: '1', B: '2'}, dev: {C: '3'}})
    })

    it('keeps the remaining simple fields', () => {
        const state = environmentsStore.state()
        mutations.setProjectPath(state, 'org/dash')
        mutations.setReady(state, true)
        mutations.setAutostop(state, 3600)
        mutations.setDefaults(state, {name: 'defaults'})
        mutations.setResourceTypeCategories(state, {db: 'Databases'})
        mutations.setResourceTypeDictionary(state, {environment: {name: 'prod'}, dict: {T: {}}})
        mutations.setAdditionalProviders(state, [{}])
        mutations.setIncrementalDeployment(state, false)
        expect(state).toMatchObject({projectPath: 'org/dash', ready: true, autostop: 3600, defaults: {name: 'defaults'}, incrementalDeploymentEnabled: true})
        expect(state.resourceTypeDictionaries).toEqual({prod: {T: {}}})
    })
})

describe('getters', () => {
    const state = () => ({
        ...environmentsStore.state(),
        projectEnvironments: [environment('prod'), environment('dev', {connections: {}, instances: {}, repositories: {}})],
        defaults: {name: 'defaults', repositories: {types: {url: 'https://x/types.git'}}},
        deploymentPaths: [
            {name: 'environments/prod/app', environment: 'prod', pipelines: [{id: 1}, {id: 2}]},
            {name: 'environments/dev/app', environment: 'dev'},
        ],
        variablesByEnvironment: {'*': {SHARED: 's', UNFURL_VAULT_DEFAULT_PASSWORD: 'pw', '_dep_7': 'tok'}, prod: {ONLY_PROD: 'p'}},
        resourceTypeDictionaries: {prod: {
            'unfurl.relationships.ConnectsTo.AWSAccount': {name: 'unfurl.relationships.ConnectsTo.AWSAccount', extends: ['unfurl.relationships.ConnectsTo.CloudAccount']},
            'DNSZone@org/std': {name: 'DNSZone@org/std', extends: ['DNSZone'], implementations: ['connect']},
        }},
        resourceTypeCategories: {db: 'Databases'},
    })

    it('looks environments, defaults and connections up', () => {
        const g = gettersOf(state())
        expect(g.lookupEnvironment('dev').name).toBe('dev')
        expect(g.lookupEnvironment('defaults').name).toBe('defaults')
        expect(g.lookupConnection('prod', 'dns')).toEqual({name: 'dns', type: 'DNSZone'})
        expect(g.lookupConnection('nope', 'dns')).toBeNull()
        expect(g.getEnvironmentDefaults.name).toBe('defaults')
    })

    it('matches environments to a cloud provider', () => {
        const g = gettersOf(state())
        expect(g.getMatchingEnvironments('aws').map(e => e.name)).toEqual(['prod'])
        expect(g.getMatchingEnvironments(undefined).map(e => e.name)).toEqual(['dev'])
        expect(g.getDefaultEnvironmentName('AWSAccount')).toBe(undefined)
        const withPrimary = {...state(), projectEnvironments: [environment('prod', {primary_provider: {type: 'aws'}})]}
        expect(gettersOf(withPrimary).getDefaultEnvironmentName('aws')).toBe('prod')
        expect(gettersOf(withPrimary).getDefaultEnvironmentName(null)).toBeNull()
    })

    it('resolves an environment\'s types, by unqualified name too', () => {
        const g = gettersOf(state())
        expect(g.environmentResolveResourceType('prod', 'DNSZone').name).toBe('DNSZone@org/std')
        expect(g.environmentResolveResourceType({name: 'prod'}, {name: 'unfurl.relationships.ConnectsTo.AWSAccount'}).extends).toEqual(['unfurl.relationships.ConnectsTo.CloudAccount'])
        expect(g.environmentResolveResourceType('prod', 'Nope')).toBeNull()
        expect(g.environmentResourceTypeDict('prod')).toHaveProperty('DNSZone@org/std')
        expect(g.environmentLookupDiscoverable('prod').map(t => t.name)).toEqual(['DNSZone@org/std'])
        expect(g.environmentLookupDiscoverable('dev')).toBeNull()
    })

    it('offers existing instances that satisfy a requirement', () => {
        const g = gettersOf(state(), {availableResourceTypesForRequirement: () => []})
        expect(g.getValidEnvironmentConnections('prod', {constraint: {resourceType: 'DNSZone'}}).map(c => c.name)).toEqual(['dns'])
        expect(g.getValidEnvironmentConnections('prod', 'Database')).toEqual([])
        expect(g.getValidEnvironmentConnections('nope', 'DNSZone')).toEqual([])
    })

    it('finds deploy paths and their last pipeline', () => {
        const g = gettersOf(state())
        expect(g.lookupDeployPath('app', 'dev').name).toBe('environments/dev/app')
        expect(g.lookupDeployPath('app', 'other').name).toBe('environments/prod/app')
        expect(g.lookupLastRecordedPipeline('app', 'prod')).toEqual({id: 2})
        expect(g.hasDeployPathKey('environments/dev/app')).toBe(true)
        expect(g.allDeploymentPaths).toHaveLength(2)
    })

    it('reads variables, falling back to the shared scope', () => {
        const g = gettersOf(state())
        expect(g.lookupVariableByEnvironment('ONLY_PROD', {name: 'prod'})).toBe('p')
        expect(g.lookupVariableByEnvironment('ONLY_PROD', 'nope')).toBeNull()
        expect(g.getVariables('prod')).toEqual({SHARED: 's', UNFURL_VAULT_DEFAULT_PASSWORD: 'pw', '_dep_7': 'tok', ONLY_PROD: 'p'})
        expect(g.lookupProjectToken(7)).toBe('tok')
        expect(g.userCanEdit).toBe(true)
        expect(gettersOf({...state(), variablesByEnvironment: {}}).userCanEdit).toBe(false)
    })

    it('lists type repositories, falling back to the defaults\'', () => {
        const g = gettersOf(state(), {getHomeProjectPath: 'org/dash'})
        expect(g.environmentTypeRepositories('prod')).toEqual([{url: 'https://unfurl.cloud/onecommons/std.git'}])
        expect(g.environmentTypeRepositories('dev')).toEqual([{url: 'https://x/types.git'}])
        expect(() => g.environmentTypeRepositories('nope')).toThrow('Environment not found nope')
        expect(g.currentEnvironmentRepositories('prod', 'app')).toEqual([{url: `${window.location.origin}/org/dash.git`, file: 'environments/prod/app/ensemble.yaml'}])
        expect(g.providerTypesForEnvironment('prod')).toEqual(['unfurl.relationships.ConnectsTo.AWSAccount'])
    })

    it('lists cloud providers among connections and instances', () => {
        const g = gettersOf(state())
        expect(g.availableProviders.map(p => `${p.environment.name}:${p.template.name}:${p.source}`)).toEqual(['prod:primary_provider:connection'])
    })

    it('reports deployments, readiness and categories', () => {
        const g = gettersOf({...state(), ready: true}, {getDeploymentsByEnvironment: name => (name == 'prod' ? [{}] : [])})
        expect(g.environmentHasActiveDeployments('prod')).toBe(true)
        expect(g.environmentHasActiveDeployments({name: 'dev'})).toBe(false)
        expect(g.environmentsAreReady).toBe(true)
        expect(g.getTypeCategory('db')).toBe('Databases')
        expect(g.additionalDashboardProviders).toEqual([])
    })
})

describe('environmentTriggerPipeline', () => {
    const rootGetters = (extra = {}) => ({
        getHomeProjectPath: 'org/dash',
        getCurrentProjectPath: 'org/bp',
        hasCriticalErrors: false,
        UNFURL_MOCK_DEPLOY: false,
        ...extra,
    })
    const state = () => ({
        ...environmentsStore.state(),
        projectPath: 'org/dash',
        repositoryDeploymentDependencies: ['org/bp', 'org/public'],
        deploymentPaths: [{name: 'environments/prod/app', pipelines: [{id: 1}]}],
        variablesByEnvironment: {'*': {}},
    })
    const parameters = {deploymentName: 'app', environmentName: 'prod', deployPath: 'environments/prod/app', projectUrl: 'https://gitlab.example/org/bp.git', workflow: 'deploy'}

    beforeEach(() => {
        fetchProjectInfo.mockImplementation(async path => ({
            'org%2Fdash': {id: 1}, 'org%2Fbp': {id: 2, visibility: 'private'}, 'org%2Fpublic': {id: 3, visibility: 'public'},
        })[path])
        prepareVariables.mockResolvedValue([{key: 'WORKFLOW', secret_value: 'deploy', masked: false}, {key: 'SECRET', secret_value: 'x', masked: true}])
        triggerAtomicDeployment.mockResolvedValue({id: 50, commit: {id: 'c50'}, project: {id: 1}})
    })

    it('triggers a deployment with tokens for private dependencies and records the pipeline', async () => {
        const ctx = context(state(), rootGetters(), {runDeploymentHooks: () => true, commitPreparedMutations: () => {}})

        const result = await ctx.dispatch('environmentTriggerPipeline', parameters)

        expect(prepareVariables).toHaveBeenCalledWith(expect.objectContaining({
            writableBlueprintProjectUrl: 'https://UNFURL_DEPLOY_TOKEN_1:$_dep_2@gitlab.example/org/bp.git',
            blueprintToken: '_dep_2',
        }))
        expect(awaitQueuedWrite).toHaveBeenCalledWith('org/dash')
        expect(triggerAtomicDeployment).toHaveBeenCalledWith('org/dash', expect.objectContaining({dependencies: {'org/bp': '_dep_2'}, schedule: 'now'}))

        const [mutation] = committed(ctx, 'pushPreparedMutation')
        const [{patch, target}] = mutation()
        expect(target).toBe('environments/prod/app')
        expect(patch).toMatchObject({environment: 'prod', project_id: 1, incremental_deploy: true})
        expect(patch.pipelines).toEqual([{id: 1}, expect.objectContaining({id: 50, commit_id: 'c50', variables: {WORKFLOW: 'deploy'}})])
        expect(committed(ctx, 'setCommitMessage')).toEqual(['Deploy app into prod'])
        expect(result.pipelineData.id).toBe(50)
        expect(ctx.state.repositoryDeploymentDependencies).toEqual([])
    })

    it('stops when a deployment hook refuses', async () => {
        const ctx = context(state(), rootGetters(), {runDeploymentHooks: () => false})
        await expect(ctx.dispatch('environmentTriggerPipeline', parameters)).resolves.toBe(false)
        expect(triggerAtomicDeployment).not.toHaveBeenCalled()
    })

    it('reports a deployment GitLab refuses', async () => {
        triggerAtomicDeployment.mockRejectedValue(new Error('400'))
        const ctx = context(state(), rootGetters(), {runDeploymentHooks: () => true})
        await ctx.dispatch('environmentTriggerPipeline', parameters)
        expect(committed(ctx, 'createError')[0]).toMatchObject({message: 'Failed to trigger deployment (400)', severity: 'critical'})
    })

    it('schedules the autostop undeploy alongside, recording both', async () => {
        const ctx = context({...state(), autostop: 3600}, rootGetters(), {runDeploymentHooks: () => true, commitPreparedMutations: () => {}})
        await ctx.dispatch('environmentTriggerPipeline', parameters)
        expect(triggerAtomicDeployment).toHaveBeenCalledWith('org/dash', expect.objectContaining({schedule: '3600 seconds'}))
        const [{patch}] = committed(ctx, 'pushPreparedMutation')[0]()
        expect(patch.pipelines).toHaveLength(3)
    })

    it('takes dependencies from the deployment when no project is open', async () => {
        const ctx = context(state(), rootGetters({
            getCurrentProjectPath: null,
            getDeploymentDictionary: () => ({
                DeploymentTemplate: {app: {projectPath: 'org/bp'}},
                repositories: {std: {url: 'https://gitlab.example/org/public.git'}},
            }),
        }), {runDeploymentHooks: () => true, commitPreparedMutations: () => {}})
        await ctx.dispatch('environmentTriggerPipeline', {...parameters, skipCommit: true})
        expect(triggerAtomicDeployment).toHaveBeenCalledWith('org/dash', expect.objectContaining({dependencies: {'org/bp': '_dep_2'}}))
        expect(ctx.commit).not.toHaveBeenCalledWith('pushPreparedMutation', expect.anything())
    })

    it('undeploys through the same path', async () => {
        const ctx = context(state(), rootGetters(), {runDeploymentHooks: () => true, commitPreparedMutations: () => {}})
        await ctx.dispatch('undeployFrom', parameters)
        expect(committed(ctx, 'setCommitMessage')).toEqual(['Undeploy app from prod'])
    })
})

describe('deleteDeployment', () => {
    it('destroys the deployment\'s variables, its deploy path and its ensemble', async () => {
        const ctx = context({
            ...environmentsStore.state(),
            variablesByEnvironment: {'*': {UNFURL_PROJECT_TOKEN: 'tok'}, prod: {my_app__PW: 'x', other__PW: 'y'}},
        }, {getHomeProjectPath: 'org/dash', lookupDeployPath: () => ({name: 'environments/prod/my-app'})}, {commitPreparedMutations: () => {}})

        await actions.deleteDeployment(ctx, {deploymentName: 'my-app', environmentName: 'prod'})

        expect(patchEnv).toHaveBeenCalledWith({my_app__PW: {_destroy: true}}, 'prod', 'org/dash')
        expect(committed(ctx, 'pushPreparedMutation')[0]()).toEqual([{typename: 'DeploymentPath', patch: null, target: 'environments/prod/my-app'}])
        expect(deleteFiles).toHaveBeenCalledWith('org%2Fdash', ['environments/prod/my-app/ensemble.yaml'], {commitMessage: 'Delete deployment records for my-app', accessToken: 'tok'})
    })
})

describe('loading environments', () => {
    it('stores the exported environments, normalized', async () => {
        getOrFetchCurrentBranch.mockResolvedValue('main')
        fetchEnvironments.mockResolvedValue({
            errors: [],
            environments: [environment('prod')],
            ResourceType: {DNSZone: {name: 'DNSZone'}},
            defaults: {name: 'defaults'},
            deploymentPaths: [{name: 'environments/prod/app'}],
            deployments: [{}],
        })
        const ctx = context(undefined, {hasCriticalErrors: false})

        await actions.fetchProjectEnvironments(ctx, {fullPath: 'org/dash'})

        expect(fetchEnvironments).toHaveBeenCalledWith(expect.objectContaining({fullPath: 'org/dash', branch: 'main', includeDeployments: true}))
        expect(ctx.state.projectEnvironments[0].instances.dns.__typename).toBe('ResourceTemplate')
        expect(ctx.state.resourceTypeDictionaries.prod).toHaveProperty('DNSZone')
        expect(ctx.state.defaults.name).toBe('defaults')
        expect(committed(ctx, 'setDeployments')).toEqual([[{}]])
    })

    it('reports a failed load and keeps no environments', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => {})
        fetchEnvironments.mockRejectedValue(new Error('500'))
        const ctx = context(undefined, {hasCriticalErrors: false})
        await actions.fetchProjectEnvironments(ctx, {fullPath: 'org/dash', branch: 'main'})
        expect(committed(ctx, 'createError')[0]).toMatchObject({severity: 'critical', issue: 'Missing environment'})
        expect(ctx.state.projectEnvironments).toEqual([])
        console.error.mockRestore()
    })

    it('groups variables by scope and adds the project DNS zone', async () => {
        fetchEnvironmentVariables.mockResolvedValue([
            {key: 'A', value: '1', environment_scope: '*'}, {key: 'B', value: '2', environment_scope: 'prod'}, {key: 'C', value: '3'},
        ])
        const ctx = context(undefined, {getCurrentNamespace: 'Team/Org'})
        await actions.fetchEnvironmentVariables(ctx, {fullPath: 'org/dash'})
        expect(ctx.state.variablesByEnvironment).toEqual({'*': {A: '1', PROJECT_DNS_ZONE: 'org.team.u.opencloudservices.net'}, prod: {B: '2'}})
    })

    it('generates the vault password and subscriptions store when missing', async () => {
        const ctx = context({...environmentsStore.state(), variablesByEnvironment: {'*': {}}}, {getHomeProjectPath: 'org/dash'})
        await actions.generateVaultPasswordIfNeeded(ctx, {fullPath: 'org/dash'})
        const names = patchEnv.mock.calls.map(([env]) => Object.keys(env)[0])
        expect(names).toEqual(['UNFURL_VAULT_DEFAULT_PASSWORD', 'UNFURL_PROJECT_SUBSCRIPTIONS'])
        expect(ctx.state.variablesByEnvironment['*'].UNFURL_VAULT_DEFAULT_PASSWORD).toHaveLength(15)
    })

    it('creates the project token once', async () => {
        fetchProjectInfo.mockResolvedValue({namespace: {}})
        generateProjectAccessToken.mockResolvedValue('glpat')
        const ctx = context({...environmentsStore.state(), variablesByEnvironment: {'*': {}}}, {getHomeProjectPath: 'org/dash'})
        await actions.createAccessTokenIfNeeded(ctx, {fullPath: 'org/dash'})
        expect(generateProjectAccessToken).toHaveBeenCalledWith('org%2Fdash', expect.objectContaining({name: 'UNFURL_PROJECT_TOKEN'}))
        expect(ctx.state.variablesByEnvironment['*'].UNFURL_PROJECT_TOKEN).toBe('glpat')

        generateProjectAccessToken.mockClear()
        await actions.createAccessTokenIfNeeded(ctx, {fullPath: 'org/dash'})
        expect(generateProjectAccessToken).not.toHaveBeenCalled()
    })

    it('loads variables and environments together, then is ready', async () => {
        const ctx = context(undefined, {getHomeProjectPath: 'org/dash'})
        ctx.dispatch = jest.fn(async () => {})
        await actions.ocFetchEnvironments(ctx, {})
        expect(ctx.dispatch.mock.calls.map(([name]) => name)).toEqual(expect.arrayContaining(['fetchEnvironmentVariables', 'fetchProjectEnvironments']))
        expect(ctx.state).toMatchObject({projectPath: 'org/dash', ready: true})
    })
})

describe('environmentFromProvider', () => {
    it('creates an environment from a provider connection, with its instances and variables', async () => {
        const provider = {
            source: 'connection',
            template: {name: 'primary_provider', type: 'AWS', properties: [{name: 'key', value: {get_env: 'KEY'}}]},
            environment: {name: 'prod', instances: {dns: {name: 'dns', properties: [{name: 'token', value: {get_env: 'DNS_TOKEN'}}]}}},
        }
        const ctx = context({...environmentsStore.state(), projectPath: 'org/dash'}, {}, {commitPreparedMutations: () => {}})

        await actions.environmentFromProvider(ctx, {provider, newEnvironmentName: 'New Env'})

        expect(shareEnvironmentVariables).toHaveBeenCalledWith('org/dash', 'prod', 'new-env', ['KEY', 'DNS_TOKEN'], '')
        const [{patch, target}] = committed(ctx, 'pushPreparedMutation')[0]()
        expect(target).toBe('new-env')
        expect(patch.connections.primary_provider.name).toBe('primary_provider')
        expect(Object.keys(patch.instances)).toEqual(['dns'])
    })

    it('copies only the provider for an instance', async () => {
        const provider = {source: 'instance', template: {name: 'k8s', properties: []}, environment: {name: 'prod', instances: {other: {}}}}
        const ctx = context({...environmentsStore.state(), projectPath: 'org/dash'}, {}, {commitPreparedMutations: () => {}})
        await actions.environmentFromProvider(ctx, {provider, newEnvironmentName: 'k'})
        expect(committed(ctx, 'pushPreparedMutation')[0]()[0].patch.instances).toEqual([])
    })
})

describe('variables and providers', () => {
    it('sets a variable locally and in GitLab', async () => {
        const ctx = context(undefined, {getHomeProjectPath: 'org/dash'})
        await actions.setEnvironmentVariable(ctx, {environmentName: 'prod', variableName: 'A', variableValue: 'v', masked: true})
        expect(ctx.state.variablesByEnvironment.prod.A).toBe('v')
        expect(patchEnv).toHaveBeenCalledWith({A: {value: 'v', masked: true}}, 'prod', 'org/dash')
    })

    it('loads providers from the other dashboards, within the limit', async () => {
        const dashboards = Array.from({length: 17}, (_, i) => ({path_with_namespace: `org/d${i}`}))
        axios.get.mockResolvedValue({data: [{path_with_namespace: 'org/dash'}, ...dashboards]})
        fetchDashboardProviders.mockImplementation(async path => (path == 'org/d0' ? null : {path}))
        const ctx = context(undefined, {getHomeProjectPath: 'org/dash'})

        await actions.loadAdditionalProviders(ctx, {})

        expect(axios.get).toHaveBeenCalledWith('/api/v4/dashboards?min_access_level=30')
        expect(fetchDashboardProviders).toHaveBeenCalledTimes(15)
        expect(ctx.state.additionalDashboardProviders).toHaveLength(14)
        expect(committed(ctx, 'createError')[0].message).toContain('too many dashboard memberships')
    })

    it('merges fetched environment types, keeping icons and complete definitions', async () => {
        const state = {
            ...environmentsStore.state(),
            projectEnvironments: [environment('prod')],
            resourceTypeDictionaries: {prod: {DNSZone: {name: 'DNSZone', icon: 'dns.svg', _sourceinfo: {}}}},
        }
        fetchTypeRepositories.mockResolvedValue({
            types: {
                DNSZone: {name: 'DNSZone', _sourceinfo: {incomplete: true}},
                Redis: {name: 'Redis', _sourceinfo: {file: 'r.yaml'}},
            },
            categories: {cache: 'Caches'},
        })
        const ctx = context(state)

        await actions.environmentFetchTypesWithParams(ctx, {environmentName: 'prod', params: {}})

        const dict = ctx.state.resourceTypeDictionaries.prod
        expect(dict.DNSZone).toMatchObject({icon: 'dns.svg'})
        expect(dict.DNSZone._sourceinfo?.incomplete).toBeFalsy()
        expect(dict.Redis.__typename).toBe('ResourceType')
        expect(ctx.state.resourceTypeCategories).toEqual({cache: 'Caches'})
    })

    it('reports a failed type fetch', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => {})
        fetchTypeRepositories.mockRejectedValue(new Error('timeout'))
        const ctx = context({...environmentsStore.state(), projectEnvironments: [environment('prod')]})
        await actions.environmentFetchTypesWithParams(ctx, {environmentName: 'prod', params: {}})
        expect(committed(ctx, 'createError')[0].message).toBe('Load environment types: failed to fetch types (timeout)')
        console.error.mockRestore()
    })
})

it('runs save hooks until one refuses', async () => {
    const later = jest.fn()
    const ctx = context({...environmentsStore.state(), saveEnvironmentHooks: [() => true, async () => false, later]})
    await expect(actions.runEnvironmentSaveHooks(ctx)).resolves.toBe(false)
    expect(later).not.toHaveBeenCalled()
})
