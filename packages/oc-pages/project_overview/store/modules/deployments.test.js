import axios from '~/lib/utils/axios_utils'
import {shareEnvironmentVariables} from 'oc_vue_shared/client_utils/environments'
import {unfurlServerExport} from 'oc_vue_shared/client_utils/unfurl-server'
import {fetchLastCommit, getOrFetchCurrentBranch} from 'oc_vue_shared/client_utils/projects'
import deploymentsStore from './deployments'

jest.mock('~/lib/utils/axios_utils', () => ({__esModule: true, default: {post: jest.fn(), delete: jest.fn()}}))
jest.mock('oc_vue_shared/client_utils/environments', () => ({shareEnvironmentVariables: jest.fn()}))
jest.mock('oc_vue_shared/client_utils/unfurl-server', () => ({unfurlServerExport: jest.fn()}))
jest.mock('oc_vue_shared/client_utils/projects', () => ({fetchLastCommit: jest.fn(), getOrFetchCurrentBranch: jest.fn()}))
jest.mock('oc_vue_shared/client_utils/user', () => ({fetchUserAccessToken: jest.fn()}))

const {mutations, actions} = deploymentsStore

// getters that read other getters, wired the way vuex wires them
function gettersOf(state, rootGetters = {}) {
    const g = {}
    for(const [name, fn] of Object.entries(deploymentsStore.getters)) {
        Object.defineProperty(g, name, {get: () => fn(state, g, {}, rootGetters), enumerable: true})
    }
    return g
}

const dict = (name, environment, extra = {}) => ({
    _environment: environment,
    Deployment: {[name]: {name, title: `${name} title`, primary: 'web'}},
    DeploymentTemplate: {[name]: {name, title: `${name} title`}},
    Resource: {web: {name: 'web', template: 'web', title: 'Web'}, db: {name: 'db', template: 'db', title: 'DB', protected: true}},
    ResourceTemplate: {web: {name: 'web', type: 'Container'}, db: {name: 'db', type: 'Postgres'}},
    ResourceType: {Container: {name: 'Container', _sourceinfo: {file: 'c.yaml'}}, Postgres: {name: 'Postgres'}},
    ApplicationBlueprint: {bp: {name: 'bp'}},
    ...extra,
})

// commit/dispatch that record what was asked and route local names to this module
function context(state = deploymentsStore.state(), rootGetters = {}) {
    const ctx = {state, rootGetters, getters: gettersOf(state, rootGetters)}
    ctx.commit = jest.fn((name, payload) => mutations[name]?.(state, payload))
    ctx.dispatch = jest.fn((name, payload) => actions[name]?.(ctx, payload))
    return ctx
}
const committed = (ctx, name) => ctx.commit.mock.calls.filter(([n]) => n == name).map(([, payload]) => payload)

beforeEach(() => { window.gon = {} })

describe('state', () => {
    it('normalizes what it stores', () => {
        const state = deploymentsStore.state()
        mutations.setDeployments(state, [dict('app', 'prod')])
        expect(state.deployments[0].ResourceType.Container.__typename).toBe('ResourceType')
        expect(state.deployments[0].Deployment.app._environment).toBe('prod')
    })

    it('collects deployment hooks and share states', () => {
        const state = deploymentsStore.state()
        const hook = () => true
        mutations.onDeploy(state, hook)
        expect(state.deploymentHooks).toEqual([hook])
        mutations.clearDeploymentHooks(state)
        expect(state.deploymentHooks).toEqual([])
        mutations.setShareState(state, {name: 'x', shareState: 'environment'})
        expect(state.shareStates).toEqual({x: 'environment'})
    })
})

describe('lookups', () => {
    const state = {...deploymentsStore.state(), deployments: [
        dict('app', 'prod'),
        dict('draft', 'prod', {Deployment: undefined}),
        dict('app', 'staging'),
    ]}
    const g = gettersOf(state, {getAdditionalDashboards: [{deployments: [dict('remote', 'other')]}]})

    it('finds a deployment\'s dictionary by name and environment', () => {
        expect(g.getDeploymentDictionary('app', 'staging')).toBe(state.deployments[2])
        expect(g.getDeploymentDictionary('draft', 'prod')).toBe(state.deployments[1])
        expect(g.getDeploymentDictionary('app', 'nowhere')).toBeNull()
        expect(g.getDeploymentDictionaries).toBe(state.deployments)
    })

    it('lists deployments, and deployments with drafts and other dashboards\'', () => {
        expect(g.getDeployments.map(d => `${d._environment}/${d.name}`)).toEqual(['prod/app', 'staging/app'])
        expect(g.getDeploymentsOrDrafts.map(d => d.name)).toEqual(['app', 'draft', 'app', 'remote'])
        expect(g.getDeploymentsByEnvironment('prod').map(d => d.name)).toEqual(['app'])
        expect(g.getDeploymentsByEnvironment(null)).toHaveLength(2)
    })

    it('looks deployments up by name or title', () => {
        expect(g.lookupDeploymentOrDraft('draft', {name: 'prod'})).toMatchObject({name: 'draft'})
        expect(g.lookupDeployment('app title', 'prod')).toMatchObject({name: 'app', _environment: 'prod'})
        expect(g.lookupDeployment('App')).toMatchObject({name: 'app'})
    })

    it('filters primaries by environment', () => {
        const primaries = g.filteredPrimariesByEnvironment('prod', (primary, {type}) => type.name == 'Container')
        expect(primaries).toEqual([{name: 'web', template: 'web', title: 'Web', _deployment: 'app', _type: {name: 'Container', _sourceinfo: {file: 'c.yaml'}}}])
    })

    it('numbers the next default deployment name past the highest in use', () => {
        const titled = {...deploymentsStore.state(), deployments: [
            dict('a', 'prod', {Deployment: {a: {name: 'a', title: 'WordPress 3', primary: 'web'}}}),
            dict('b', 'prod', {Deployment: undefined, DeploymentTemplate: {b: {name: 'b', title: 'WordPress 7'}}}),
        ]}
        expect(gettersOf(titled).getNextDefaultDeploymentName('WordPress', 'prod')).toBe('WordPress 8')
        expect(gettersOf(titled).getNextDefaultDeploymentName('Ghost', 'prod')).toBe('Ghost 1')
    })

    // template titles are free text
    it('numbers a title with regex characters in it', () => {
        const titled = {...deploymentsStore.state(), deployments: [
            dict('a', 'prod', {Deployment: {a: {name: 'a', title: 'C++ (beta) 2', primary: 'web'}}}),
        ]}
        expect(gettersOf(titled).getNextDefaultDeploymentName('C++ (beta)', 'prod')).toBe('C++ (beta) 3')
    })

    it('finds the environment a deployment lives in, preferring the one asked for', () => {
        const paths = [{name: 'environments/prod/app', environment: 'prod'}, {name: 'environments/staging/app', environment: 'staging'}]
        const g2 = gettersOf(state, {allDeploymentPaths: paths})
        expect(g2.getEnvironmentForDeployment('app')).toBe('prod')
        expect(g2.getEnvironmentForDeployment('app', 'staging')).toBe('staging')
    })
})

describe('sharing resources', () => {
    const rootGetters = (overrides = {}) => ({
        getEnvironmentDefaults: {instances: {'__prod__app__web': {}}},
        lookupConnection: (env, name) => name == '__prod__app__db' ? {} : null,
        lookupEnvironment: () => ({name: 'prod', instances: {}}),
        getCardsStacked: [{name: 'web', title: 'Web', type: 'Container'}],
        getPrimaryCard: {name: 'app', title: 'App', type: 'App'},
        resolveResourceTypeFromAny: () => ({extends: ['Container'], _sourceinfo: {file: 'c.yaml'}}),
        getHomeProjectPath: 'org/dash',
        ...overrides,
    })
    const state = {...deploymentsStore.state(), deployments: [dict('app', 'prod')]}

    it('reads where a resource is shared', () => {
        const g = gettersOf(state, rootGetters())
        expect(g.getResourceSharedState('prod', 'app', 'web')).toBe('dashboard')
        expect(g.getResourceSharedState('prod', 'app', 'db')).toBe('environment')
        expect(g.getResourceSharedState('prod', 'app', 'none')).toBeNull()
        expect(g.listSharedResources('app', 'prod').map(r => r.name)).toEqual(['web', 'db'])
        expect(g.getSharedResource('app', 'prod', 'db')).toMatchObject({title: 'DB'})
        expect(g.getSharedResourceTemplate('app', 'prod', 'db')).toMatchObject({type: 'Postgres'})
    })

    it('explains what blocks deleting or undeploying', () => {
        const g = gettersOf(state, rootGetters())
        expect(g.deleteDeploymentPreventedBy('app', 'prod')).toHaveLength(2)
        expect(g.undeployPreventedBy('app', 'prod')).toEqual(['An unprotected shared resource <b>Web</b> exists in this deployment.'])
    })

    it('shares a resource into an environment as a selectable instance', async () => {
        const ctx = context({...state, shareStates: {}}, rootGetters({getEnvironmentDefaults: {instances: {}}, lookupConnection: () => null}))

        await actions.updateResourceSharedState(ctx, {environmentName: 'prod', deploymentName: 'app', resourceName: 'web', shareState: 'environment'})

        expect(ctx.state.shareStates.__prod__app__web).toBe('environment')
        const [mutation] = committed(ctx, 'pushPreparedMutation')
        const [{target, patch, typename}] = mutation({})
        expect({target, typename}).toEqual({target: 'prod', typename: 'DeploymentEnvironment'})
        expect(patch.instances.__prod__app__web).toMatchObject({imported: 'app:web', directives: ['select'], type: 'Container', metadata: {extends: ['Container']}})
        expect(ctx.dispatch).toHaveBeenCalledWith('commitPreparedMutations')
    })

    it('shares one into the dashboard defaults', async () => {
        const ctx = context({...state, shareStates: {}}, rootGetters({getEnvironmentDefaults: {instances: {}}, lookupConnection: () => null}))
        await actions.updateResourceSharedState(ctx, {environmentName: 'prod', deploymentName: 'app', resourceName: 'web', shareState: 'dashboard'})
        const [{target, patch}] = committed(ctx, 'pushPreparedMutation')[0]({})
        expect(target).toBe('defaults')
        expect(patch.instances.__prod__app__web.imported).toBe('app:web')
    })

    it('unshares before sharing elsewhere, and does nothing for no change', async () => {
        const ctx = context({...state, shareStates: {__prod__app__web: 'dashboard'}}, rootGetters())
        await actions.updateResourceSharedState(ctx, {environmentName: 'prod', deploymentName: 'app', resourceName: 'web', shareState: 'dashboard'})
        expect(ctx.commit).not.toHaveBeenCalled()

        await actions.updateResourceSharedState(ctx, {environmentName: 'prod', deploymentName: 'app', resourceName: 'web', shareState: 'environment'})
        const mutations = committed(ctx, 'pushPreparedMutation').map(m => m({})[0])
        expect(mutations[0]).toMatchObject({target: 'defaults'})
        expect(mutations[0].patch.instances).toHaveProperty('__prod__app__web', undefined)
        expect(mutations[1]).toMatchObject({target: 'prod'})
    })

    it('unshares from an environment', async () => {
        const ctx = context({...state, shareStates: {__prod__app__db: 'environment'}}, rootGetters())
        await actions.unshareResource(ctx, {environmentName: 'prod', deploymentName: 'app', resourceName: 'db'})
        const [{target, patch}] = committed(ctx, 'pushPreparedMutation')[0]({})
        expect(target).toBe('prod')
        expect(patch.instances).toHaveProperty('__prod__app__db', undefined)
    })
})

describe('deployment path pointers', () => {
    it('records which environment a deployment directory belongs to', async () => {
        const ctx = context(undefined, {getHomeProjectPath: 'org/dash'})
        await actions.createDeploymentPathPointer(ctx, {environment: {name: 'prod'}, deploymentDir: 'environments/prod/app', dryRun: true})

        expect(committed(ctx, 'setUpdateObjectProjectPath')).toEqual(['org/dash'])
        expect(committed(ctx, 'pushPreparedMutation')[0]()).toEqual([{typename: 'DeploymentPath', patch: {__typename: 'DeploymentPath', environment: 'prod'}, target: 'environments/prod/app'}])
        expect(ctx.dispatch).toHaveBeenCalledWith('runEnvironmentSaveHooks', null, {root: true})
        expect(ctx.dispatch).toHaveBeenCalledWith('commitPreparedMutations', {dryRun: true}, {root: true})
    })
})

describe('cloning a deployment', () => {
    const source = () => dict('app', 'prod', {
        DeploymentTemplate: {app: {name: 'app', title: 'App', ResourceTemplate: {}}},
        ResourceTemplate: {
            web: {name: 'web', type: 'Container', properties: [{name: 'pw', value: {get_env: 'app__PW'}}]},
            fallback: {name: 'fallback', type: 'Container', directives: ['default']},
        },
    })
    const rootGetters = {
        hasPreparedMutations: false,
        lookupDeployPath: () => ({name: 'environments/prod/app'}),
        getHomeProjectPath: 'org/dash',
    }

    it('copies the templates under a new name and directory, with renamed variables', async () => {
        shareEnvironmentVariables.mockResolvedValue({transferredVariables: ['app__PW']})
        const ctx = context({...deploymentsStore.state(), deployments: [source()]}, rootGetters)

        const name = await actions.cloneDeployment(ctx, {deployment: 'app', environment: 'prod', newDeploymentTitle: 'My Copy', targetEnvironment: {name: 'staging'}})

        expect(name).toBe('my-copy')
        expect(shareEnvironmentVariables).toHaveBeenCalledWith('org/dash', 'prod', 'staging', ['app__PW'], false, [[/^app__/, 'my_copy__']])
        expect(committed(ctx, 'setUpdateObjectPath')).toEqual(['environments/staging/my-copy'])

        const patches = Object.fromEntries(committed(ctx, 'pushPreparedMutation').map(m => m()[0]).map(p => [`${p.typename}.${p.target}`, p.patch]))
        expect(patches['DeploymentTemplate.my-copy']).toEqual({name: 'my-copy', slug: 'my-copy', title: 'My Copy'})
        expect(patches['ResourceTemplate.web']._sourceinfo).toEqual({file: 'c.yaml'})
        expect(patches['ResourceTemplate.web'].properties[0].value.get_env).toBe('my_copy__PW')
        expect(patches).not.toHaveProperty('ResourceTemplate.fallback')
        expect(ctx.dispatch).toHaveBeenCalledWith('createDeploymentPathPointer', expect.objectContaining({environment: 'staging', deploymentDir: 'environments/staging/my-copy'}))
    })

    it('picks a fresh name when the title is taken or missing', async () => {
        shareEnvironmentVariables.mockResolvedValue({transferredVariables: []})
        const ctx = context({...deploymentsStore.state(), deployments: [source()]}, rootGetters)
        const name = await actions.cloneDeployment(ctx, {deployment: 'app', environment: 'prod', newDeploymentTitle: 'app'})
        expect(name).toMatch(/^clone-[0-9a-z]+$/)
    })

    it('refuses while changes are staged', async () => {
        const ctx = context(undefined, {...rootGetters, hasPreparedMutations: true})
        await actions.cloneDeployment(ctx, {deployment: 'app', environment: 'prod'})
        expect(committed(ctx, 'createError')[0]).toMatchObject({severity: 'critical'})
    })
})

describe('project subscriptions', () => {
    const subscriptions = (value) => ({lookupVariableByEnvironment: () => value})

    it('subscribes on the first use and unsubscribes on the last', async () => {
        const store = JSON.stringify({subscriptions: {'org/up': [{}]}})
        await actions.updateProjectSubscription({rootGetters: {...subscriptions(store), getHomeProjectPath: 'org/dash'}}, {projectPath: 'Org/Up', op: 'inc'})
        expect(axios.post).toHaveBeenCalledWith('/org/dash/-/subscriptions?upstream=Org%2FUp')

        const empty = JSON.stringify({subscriptions: {'org/up': []}})
        await actions.updateProjectSubscription({rootGetters: {...subscriptions(empty), getHomeProjectPath: 'org/dash'}}, {projectPath: 'org/up', op: 'dec'})
        expect(axios.delete).toHaveBeenCalledWith('/org/dash/-/subscriptions?upstream=org%2Fup')
    })

    it('posts the queued subscriptions for this deployment\'s cards', async () => {
        const store = JSON.stringify({queued: {'Org/Up': [
            {resourceName: 'web', deploymentName: 'app', environmentName: 'prod'},
            {resourceName: 'web', deploymentName: 'other', environmentName: 'prod'},
        ]}})
        const ctx = context(undefined, {
            ...subscriptions(store),
            getCurrentEnvironment: {name: 'prod'},
            getDeploymentTemplate: {name: 'app'},
            getCardsStacked: [{name: 'web', properties: [{name: 'project_id', value: 'org/up'}]}],
        })
        ctx.dispatch = jest.fn()

        await actions.postQueuedProjectSubscriptions(ctx)

        const [, {variableValue}] = ctx.dispatch.mock.calls[0]
        expect(JSON.parse(variableValue)).toEqual({subscriptions: {'org/up': [{resourceName: 'web', deploymentName: 'app', environmentName: 'prod'}]}})
        expect(ctx.dispatch).toHaveBeenCalledWith('updateProjectSubscription', {projectPath: 'org/up', op: 'inc'})
    })

    it('does nothing with nothing queued', async () => {
        const ctx = context(undefined, subscriptions(JSON.stringify({subscriptions: {}})))
        await actions.postQueuedProjectSubscriptions(ctx)
        expect(ctx.dispatch).not.toHaveBeenCalled()
    })
})

describe('deployment hooks', () => {
    it('runs every hook, then posts subscriptions', async () => {
        const ctx = context({...deploymentsStore.state(), deploymentHooks: [() => true, async () => undefined]})
        ctx.dispatch = jest.fn()
        await expect(actions.runDeploymentHooks(ctx)).resolves.toBe(true)
        expect(ctx.dispatch).toHaveBeenCalledWith('postQueuedProjectSubscriptions')
    })

    it('stops at a hook that refuses', async () => {
        const later = jest.fn()
        const ctx = context({...deploymentsStore.state(), deploymentHooks: [async () => false, later]})
        await expect(actions.runDeploymentHooks(ctx)).resolves.toBe(false)
        expect(later).not.toHaveBeenCalled()
    })
})

describe('renameDeployment', () => {
    it('retitles the deployment and its template', async () => {
        const ctx = context({...deploymentsStore.state(), deployments: [dict('app', 'prod')]}, {
            lookupDeployPath: () => ({name: 'environments/prod/app'}), getHomeProjectPath: 'org/dash',
        })
        await actions.renameDeployment(ctx, {deploymentName: 'app', environmentName: 'prod', newTitle: 'Renamed'})

        const patches = committed(ctx, 'pushPreparedMutation').map(m => m()[0])
        expect(patches.map(p => [p.typename, p.patch.title])).toEqual([['Deployment', 'Renamed'], ['DeploymentTemplate', 'Renamed']])
        expect(committed(ctx, 'setUpdateObjectPath')).toEqual(['environments/prod/app'])
    })

    it('does nothing for the same title', async () => {
        const ctx = context({...deploymentsStore.state(), deployments: [dict('app', 'prod')]}, {lookupDeployPath: () => ({name: 'x'})})
        await actions.renameDeployment(ctx, {deploymentName: 'app', environmentName: 'prod', newTitle: 'app title'})
        expect(ctx.commit).not.toHaveBeenCalled()
    })
})

describe('fetchDeployment', () => {
    const rootGetters = {lookupDeployPath: () => ({name: 'environments/prod/app'})}

    beforeEach(() => {
        getOrFetchCurrentBranch.mockResolvedValue('main')
        fetchLastCommit.mockResolvedValue(['abc', 'main', 0, false])
    })

    it('exports the deployment at a fresh commit and stores it', async () => {
        unfurlServerExport.mockResolvedValue({Deployment: {app: {name: 'app'}}, ResourceType: {T: {name: 'T'}}})
        const ctx = context(undefined, rootGetters)

        await actions.fetchDeployment(ctx, {deploymentName: 'app', environmentName: 'prod', projectPath: 'org/dash'})

        expect(unfurlServerExport).toHaveBeenCalledWith(expect.objectContaining({format: 'deployment', projectPath: 'org/dash', deploymentPath: 'environments/prod/app', branch: 'main'}))
        expect(ctx.state.deployments[0]._environment).toBe('prod')
        expect(ctx.state.deployments[0].Deployment.app.__typename).toBe('Deployment')
    })

    it('reports a failed export with the server\'s body', async () => {
        unfurlServerExport.mockRejectedValue(Object.assign(new Error('500 error'), {response: {data: {code: 'X'}}}))
        const ctx = context(undefined, rootGetters)
        await actions.fetchDeployment(ctx, {deploymentName: 'app', environmentName: 'prod', projectPath: 'org/dash', branch: 'dev'})
        expect(committed(ctx, 'createError')[0]).toMatchObject({severity: 'critical', context: expect.objectContaining({code: 'X', branch: 'dev'})})
        expect(ctx.state.deployments).toEqual([])
    })

    // an export that failed server-side has no Deployment to read
    it('reports a deployment the server could not export, with a message, without throwing', async () => {
        unfurlServerExport.mockResolvedValue({deployment: 'environments/prod/app', error: 'boom'})
        const ctx = context(undefined, rootGetters)

        await actions.fetchDeployment(ctx, {deploymentName: 'app', environmentName: 'prod', projectPath: 'org/dash'})

        const errors = committed(ctx, 'createError')
        expect(errors.length).toBeGreaterThan(0)
        for(const error of errors) expect(error.message).toEqual(expect.any(String))
        expect(errors[0]).toMatchObject({error: 'boom'})
    })
})
