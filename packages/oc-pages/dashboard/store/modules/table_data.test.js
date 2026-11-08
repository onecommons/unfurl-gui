import {fetchProjectInfo} from 'oc_vue_shared/client_utils/projects'
import tableData from './table_data'

jest.mock('oc_vue_shared/client_utils/projects', () => ({fetchProjectInfo: jest.fn()}))

const {mutations, actions, getters} = tableData

const environments = [{name: 'prod'}, {name: 'staging'}]

const deploymentDict = (name, environment, extra = {}) => ({
    _environment: environment,
    Deployment: {[name]: {__typename: 'Deployment', name, primary: 'web', status: 1, deploymentTemplate: 'dt'}},
    DeploymentTemplate: {dt: {name: 'dt', projectPath: 'org/bp', branch: 'main'}},
    ApplicationBlueprint: {bp: {name: `${name}-app`, projectIcon: 'icon.png'}},
    Resource: {web: {name: 'web', template: 'web'}, secret: {name: 'secret', visibility: 'hidden'}},
    ResourceTemplate: {web: {type: 'Container@org/std'}},
    ...extra,
})

function load(dictionaries, {lastPipeline = () => null, withDefaults = null} = {}) {
    const state = tableData.state()
    const ctx = {
        commit: jest.fn((name, payload) => mutations[name]?.(state, payload)),
        dispatch: jest.fn(),
        rootGetters: {
            getHomeProjectPath: 'org/dash',
            getEnvironments: environments,
            getDeploymentDictionaries: dictionaries,
            lookupEnvironment: name => (name == 'defaults' ? withDefaults : undefined),
            lookupLastRecordedPipeline: lastPipeline,
        },
    }
    return actions.loadDashboard(ctx).then(() => ({state, ctx}))
}

beforeEach(() => sessionStorage.clear())

describe('loadDashboard', () => {
    // one row per leaf: a deployment's row only when it has no resources, an
    // environment's only when it has no deployments; each carries the context above it
    it('fetches the environments and lists the leaf rows, hidden resources left out', async () => {
        const {state, ctx} = await load([deploymentDict('app', 'prod')])

        expect(ctx.dispatch).toHaveBeenCalledWith('ocFetchEnvironments', {fullPath: 'org/dash'})
        expect(state.items.map(i => i.id)).toEqual(['prod.app.web', 'staging'])
        expect(state.loaded).toBe(true)

        const resourceRow = state.items[0]
        expect(resourceRow).toMatchObject({environmentName: 'prod', type: 'Container'})
        expect(resourceRow.deployment).toMatchObject({name: 'app', projectPath: 'org/bp', branch: 'main'})
        expect(resourceRow.application).toMatchObject({name: 'app-app', projectPath: 'org/bp'})
        expect(Object.isFrozen(resourceRow)).toBe(true)
    })

    it('counts running and total deployments, applications and environments', async () => {
        const {state} = await load([
            deploymentDict('app', 'prod'),
            deploymentDict('other', 'staging', {Deployment: {other: {__typename: 'Deployment', name: 'other', primary: 'web', status: 2, deploymentTemplate: 'dt'}}}),
        ])
        expect(state.counters).toEqual({deployments: 1, applications: 2, environments: 2, totalDeployments: 2})
    })

    it('lists a draft by its deployment template', async () => {
        const {state} = await load([deploymentDict('draft', 'prod', {Deployment: undefined})])
        expect(state.items.find(i => i.id == 'prod.dt.web')?.deployment).toMatchObject({name: 'dt'})
    })

    it('leaves out system deployments', async () => {
        const {state} = await load([deploymentDict('app', 'prod')], {
            lastPipeline: () => ({variables: {SYSTEM_DEPLOYMENT: 'true'}}),
        })
        expect(state.items.map(i => i.id)).toEqual(['prod', 'staging'])
    })

    it('adds the defaults environment when a deployment lives there, without touching the store\'s list', async () => {
        const {state} = await load([deploymentDict('app', 'defaults')], {withDefaults: {name: 'defaults'}})
        expect(state.items.map(i => i.id)).toContain('defaults.app.web')
        expect(environments).toHaveLength(2)
    })

    it('looks up a project icon when the blueprint has none', async () => {
        fetchProjectInfo.mockResolvedValue({avatar_url: 'avatar.png'})
        const {state} = await load([deploymentDict('app', 'prod', {ApplicationBlueprint: {bp: {name: 'app-app'}}})])
        await expect(state.items[0].application.projectIcon).resolves.toBe('avatar.png')
        expect(fetchProjectInfo).toHaveBeenCalledWith('org%2Fbp')
    })

    it('reports a deployment with no project path', async () => {
        const {ctx} = await load([deploymentDict('app', 'prod', {DeploymentTemplate: {}, Deployment: undefined})]).catch(e => ({error: e}))
        if(ctx) expect(ctx.commit).toHaveBeenCalledWith('createError', expect.objectContaining({message: "Load dashboard: Couldn't find project path"}))
    })
})

it('reads the counters, adding open merge requests to the total', () => {
    const state = {loaded: true, items: [1], counters: {deployments: 1, applications: 2, environments: 3, totalDeployments: 4}}
    expect(getters.isDashboardLoaded(state)).toBe(true)
    expect(getters.getDashboardItems(state)).toEqual([1])
    expect(getters.runningDeploymentsCount(state)).toBe(1)
    expect(getters.applicationsCount(state)).toBe(2)
    expect(getters.environmentsCount(state)).toBe(3)
    expect(getters.totalDeploymentsCount(state, {}, {}, {mergeRequests: [{}, {}]})).toBe(6)
})
