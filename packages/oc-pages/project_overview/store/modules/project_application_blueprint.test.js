import Vuex from 'vuex'
import {unfurlServerExport, fetchTypeRepositories, unfurlServerGetTypes} from 'oc_vue_shared/client_utils/unfurl-server'
import {fetchLastCommit} from 'oc_vue_shared/client_utils/projects'
import blueprint from './project_application_blueprint'

jest.mock('oc_vue_shared/client_utils/unfurl-server', () => ({
    unfurlServerExport: jest.fn(),
    fetchTypeRepositories: jest.fn(),
    unfurlServerGetTypes: jest.fn(),
    repoToExportParams: jest.requireActual('oc_vue_shared/client_utils/unfurl-server').repoToExportParams,
}))
jest.mock('oc_vue_shared/client_utils/projects', () => ({fetchLastCommit: jest.fn()}))

// the module in a store, with the root mutations it commits recorded
function makeStore(rootGetters = {}) {
    const recorded = {errors: [], repositoryDependencies: [], cleared: 0}
    const store = new Vuex.Store({
        modules: {blueprint},
        mutations: {
            createError(_, error) { recorded.errors.push(error) },
            addRepositoryDependencies(_, deps) { recorded.repositoryDependencies.push(...deps) },
            clearRepositoryDependencies() { recorded.cleared++ },
        },
        getters: {getGlobalVars: () => rootGetters.getGlobalVars || {}},
    })
    return {store, recorded, state: store.state.blueprint}
}

// a small blueprint export, fresh each time: normalization mutates it
const exportRoot = () => ({
    ApplicationBlueprint: {wp: {name: 'wp', primary: 'WordPress'}},
    ResourceType: {
        WordPress: {name: 'WordPress', requirements: [{name: 'db', resourceType: 'MySQL'}], inputsSchema: {properties: {title: {}, admin: {}}}, computedPropertiesSchema: {properties: {url: {}}}, _sourceinfo: {file: 'wp.yaml'}},
        'MySQL@unfurl.cloud/std': {name: 'MySQL@unfurl.cloud/std', inputsSchema: {properties: {size: {}}}},
        Compute: {name: 'Compute'},
    },
    ResourceTemplate: {
        the_app: {name: 'the_app', type: 'WordPress', directives: [], dependencies: [{name: 'db', match: 'the_db', constraint: {name: 'db'}}], properties: [
            {name: 'title', value: 'Blog'},
            {name: 'url', value: 'https://x'},
            {name: 'secret', value: '<<REDACTED>>'},
            {name: 'token', value: {get_env: ['TOKEN', 'default']}},
        ]},
        the_db: {name: 'the_db', type: 'MySQL', directives: [], dependencies: [], properties: {size: 'small'}},
        fallback: {name: 'fallback', type: 'Compute', directives: ['default'], dependencies: []},
    },
    DeploymentTemplate: {
        aws: {name: 'aws', primary: 'the_app', source: 'base', ResourceTemplate: {}},
        base: {name: 'base', primary: 'the_app', visibility: 'hidden', ResourceTemplate: {fallback: {name: 'fallback', type: 'Compute', directives: ['default'], dependencies: []}}},
    },
    repositories: {std: {url: `${window.location.origin}/org/std.git`}, gh: {url: 'https://github.com/x/y.git'}},
})

beforeEach(() => {
    fetchLastCommit.mockResolvedValue(['abc', 'main', 0, true])
    jest.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => console.warn.mockRestore())

describe('fetchProject', () => {
    it('exports the blueprint, normalizes it into the store and reports when loaded', async () => {
        unfurlServerExport.mockResolvedValue(exportRoot())
        const {store, recorded, state} = makeStore()
        const loaded = jest.fn()
        store.commit('onApplicationBlueprintLoaded', loaded)

        await store.dispatch('fetchProject', {projectPath: 'org/wp', projectGlobal: {g: 1}})

        expect(unfurlServerExport).toHaveBeenCalledWith(expect.objectContaining({format: 'blueprint', projectPath: 'org/wp', setCurrentBranch: true, sendCredentials: true}))
        expect(state.loaded).toBe(true)
        expect(loaded).toHaveBeenCalled()
        expect(store.getters.getApplicationBlueprint).toMatchObject({name: 'wp', title: 'wp', projectPath: 'org/wp', __typename: 'ApplicationBlueprint'})
        expect(state.projectGlobal).toEqual({g: 1})
        expect(recorded.repositoryDependencies).toEqual(['org/wp', 'org/std'])
    })

    it('reports a failed export', async () => {
        unfurlServerExport.mockRejectedValue(Object.assign(new Error('500 error'), {response: {data: {code: 'X'}}}))
        const {store, recorded} = makeStore()
        await store.dispatch('fetchProject', {projectPath: 'org/wp'})
        expect(recorded.errors).toEqual([expect.objectContaining({message: 'An error occurred while exporting org/wp', severity: 'critical', context: expect.objectContaining({code: 'X'})})])
    })

    it('skips the export when editing and nothing has moved since it loaded', async () => {
        unfurlServerExport.mockResolvedValue(exportRoot())
        const {store} = makeStore()
        await store.dispatch('fetchProject', {projectPath: 'org/wp', forEditing: true})
        expect(unfurlServerExport).toHaveBeenCalledTimes(1)

        fetchLastCommit.mockResolvedValue(['abc', 'main', 0, false])
        await store.dispatch('fetchProject', {projectPath: 'org/wp', forEditing: true})
        expect(unfurlServerExport).toHaveBeenCalledTimes(1)

        fetchLastCommit.mockResolvedValue(['abc', 'main', 3, false])
        await store.dispatch('fetchProject', {projectPath: 'org/wp', forEditing: true})
        expect(unfurlServerExport).toHaveBeenCalledTimes(2)
    })

    it('pins the branch the deployment was made from, without recording it as current', async () => {
        unfurlServerExport.mockResolvedValue(exportRoot())
        const {store} = makeStore()
        store.commit('setProjectState', {key: 'Deployment', value: {dep: {packages: {'org/wp': {version: 'v2'}}}}})
        await store.dispatch('fetchProject', {projectPath: 'org/wp'})
        expect(unfurlServerExport).toHaveBeenLastCalledWith(expect.objectContaining({branch: 'v2', setCurrentBranch: true}))

        await store.dispatch('fetchProject', {projectPath: 'org/wp', branch: 'pinned'})
        expect(unfurlServerExport).toHaveBeenLastCalledWith(expect.objectContaining({branch: 'pinned', setCurrentBranch: false}))
    })

    it('leaves credentials off for the public project being viewed', async () => {
        unfurlServerExport.mockResolvedValue(exportRoot())
        const {store} = makeStore({getGlobalVars: {projectPath: 'org/wp', projectVisibility: 'public'}})
        await store.dispatch('fetchProject', {projectPath: 'org/wp'})
        expect(unfurlServerExport).toHaveBeenCalledWith(expect.objectContaining({sendCredentials: false}))
    })
})

describe('normalizing a blueprint', () => {
    async function loaded() {
        unfurlServerExport.mockResolvedValue(exportRoot())
        const made = makeStore()
        await made.store.dispatch('fetchProject', {projectPath: 'org/wp'})
        return made
    }

    it('fills in templates from their types', async () => {
        const {state} = await loaded()
        const app = state.ResourceTemplate.the_app

        expect(app.properties.map(p => p.name)).toEqual(['title', 'secret', 'token', 'admin'])
        expect(app.computedProperties.map(p => p.name)).toEqual(['url'])
        expect(app.properties.find(p => p.name == 'secret').value).toBeNull()
        expect(app.properties.find(p => p.name == 'token').value.get_env).toBe('TOKEN')
        expect(app._sourceinfo).toEqual({file: 'wp.yaml'})
        expect(app.__typename).toBe('ResourceTemplate')
    })

    it('turns keyed properties into a list and adds missing dependencies', async () => {
        const {state} = await loaded()
        const db = state.ResourceTemplate.the_db
        expect(db.properties).toEqual([{name: 'size', value: 'small'}])
    })

    it('links each template to the templates that depend on it', async () => {
        const {state} = await loaded()
        const [[parent, requirement]] = state.ResourceTemplate.the_db._ancestors
        expect(parent.name).toBe('the_app')
        expect(requirement).toBe('db')
        expect(state.ResourceTemplate.the_app._ancestors).toEqual([])
    })

    it('normalizes deployment templates', async () => {
        const {state} = await loaded()
        expect(state.DeploymentTemplate.aws).toMatchObject({projectPath: 'org/wp', __typename: 'DeploymentTemplate', _sourceTemplate: 'base'})
    })

    // KNOWN BUG, pinned rather than fixed: the transform checks _sourceTemplate
    // before localNormalize derives it from `source`, so a deployment template
    // never receives its source's default templates on load.
    it('does not yet copy the default templates of a deployment template\'s source', async () => {
        const {state} = await loaded()
        expect(Object.keys(state.DeploymentTemplate.aws.ResourceTemplate)).toEqual([])
    })

    it('stops an ancestor chain at a cycle', async () => {
        const root = exportRoot()
        root.ResourceTemplate.the_db.dependencies = [{name: 'back', match: 'the_app', constraint: {name: 'back'}}]
        unfurlServerExport.mockResolvedValue(root)
        const {state} = makeStore()
        const {store} = makeStore()
        await store.dispatch('fetchProject', {projectPath: 'org/wp'})
        expect(store.state.blueprint.ResourceTemplate.the_db._ancestors.length).toBeLessThanOrEqual(1)
        void state
    })

    it('normalizes resources, deployments and environment connections', async () => {
        const root = exportRoot()
        root.Resource = {web: {name: 'web', template: 'the_app', connections: [{name: 'db', constraint: {}}], attributes: [{name: 'pw', value: {secret: 'PW'}}]}}
        root.Deployment = {dep: {name: 'dep', deploymentTemplate: 'aws'}}
        root.DeploymentEnvironment = {prod: {name: 'prod', connections: {primary_provider: {name: 'primary_provider', type: 'Compute', dependencies: []}}}}
        unfurlServerExport.mockResolvedValue(root)
        const {store} = makeStore()

        await store.dispatch('fetchProject', {projectPath: 'org/wp'})

        const state = store.state.blueprint
        expect(state.Resource.web).toMatchObject({type: 'WordPress', visibility: 'inherit', __typename: 'Resource', dependencies: [{name: 'db', visibility: 'visible'}]})
        expect(state.Resource.web.attributes[0].value.get_env).toBe('PW')
        // KNOWN BUG, pinned rather than fixed: the Deployment transform resolves
        // its template through the getters, but templates are committed only
        // after normalizing, so projectPath stays unset on a first load.
        expect(state.Deployment.dep.projectPath).toBeUndefined()
        expect(state.ResourceTemplate.primary_provider).toMatchObject({name: 'primary_provider', __typename: 'ResourceTemplate'})
        expect(store.getters.resolveResource('web')).toBe(state.Resource.web)
        expect(store.getters.getResources).toHaveLength(1)
        expect(store.getters.getDeployment.name).toBe('dep')
        expect(store.getters.resolveDeployment('dep').name).toBe('dep')
    })

    it('fetches substitutes for a single-cloud blueprint', async () => {
        const root = exportRoot()
        root.ResourceTemplate.the_db.directives = ['substitute']
        root.ResourceType.MySQL = {name: 'MySQL', _sourceinfo: {url: 'https://unfurl.cloud/org/std.git#main', file: 'db.yaml'}}
        root.DeploymentTemplate = {aws: {name: 'aws', cloud: 'AWSAccount', primary: 'the_app'}}
        unfurlServerExport.mockResolvedValue(root)
        unfurlServerGetTypes.mockResolvedValue({ResourceType: {AwsMySQL: {name: 'AwsMySQL', directives: ['substitute']}, Other: {name: 'Other'}}})
        const {store} = makeStore()

        await store.dispatch('fetchProject', {projectPath: 'org/wp'})

        expect(unfurlServerGetTypes).toHaveBeenCalledWith(
            {projectPath: 'org/std', branch: 'main', file: 'db.yaml'},
            {implementations: ['create'], implementation_requirements: ['AWSAccount'], extends: ['MySQL']},
        )
        expect(store.state.blueprint.ResourceType).toHaveProperty('AwsMySQL')
        expect(store.state.blueprint.ResourceType).not.toHaveProperty('Other')
    })
})

describe('resolvers', () => {
    async function loaded() {
        unfurlServerExport.mockResolvedValue(exportRoot())
        const {store} = makeStore()
        await store.dispatch('fetchProject', {projectPath: 'org/wp'})
        return store
    }

    it('resolves types by name, or by an unqualified name', async () => {
        const store = await loaded()
        expect(store.getters.resolveResourceType('WordPress').name).toBe('WordPress')
        expect(store.getters.resolveResourceType('MySQL').name).toBe('MySQL@unfurl.cloud/std')
        expect(store.getters.resolveResourceType('Nope')).toBeNull()
    })

    it('resolves a deployment template with its primary, and templates and local templates', async () => {
        const store = await loaded()
        expect(store.getters.resolveDeploymentTemplate('aws')._primary.name).toBe('the_app')
        expect(store.getters.resolveResourceTemplate('the_db').name).toBe('the_db')
        expect(store.getters.resolveLocalResourceTemplate('base', 'fallback').name).toBe('fallback')
        expect(store.getters.resolveLocalResourceTemplate('nope', 'x')).toBeNull()
        expect(store.getters.localResourceTemplates('base').map(t => t.name)).toEqual(['fallback'])
        expect(store.getters.localResourceTemplates('nope')).toEqual([])
        expect(store.getters.topLevelTemplates.map(t => t.name)).toEqual(['the_app', 'the_db', 'fallback'])
        expect(store.getters.resolveResourceTemplateType('the_app').name).toBe('WordPress')
    })

    it('narrows a type through the requirements filters of its ancestors', async () => {
        const root = exportRoot()
        root.ResourceType.WordPress.requirements = [{name: 'db', requirementsFilter: [{name: 'extra', min: 1}], inputsSchema: {properties: {size: {default: 'large'}}}}]
        unfurlServerExport.mockResolvedValue(root)
        const {store} = makeStore()
        await store.dispatch('fetchProject', {projectPath: 'org/wp'})

        const narrowed = store.getters.resolveResourceTypeWithAncestors('MySQL', [[{type: 'WordPress'}, 'db']])
        expect(narrowed.inputsSchema.properties.size).toEqual({default: 'large'})
        expect(narrowed.requirements).toEqual([{name: 'extra', min: 1}])
        // the stored type is untouched
        expect(store.getters.resolveResourceType('MySQL').inputsSchema.properties.size).toEqual({})
        expect(store.getters.resolveResourceTypeWithAncestors('MySQL', [])).toBe(store.getters.resolveResourceType('MySQL'))
    })

    it('derives dependencies and properties from a type', async () => {
        const store = await loaded()
        expect(store.getters.dependenciesFromResourceType('WordPress')).toEqual([{name: 'db', constraint: expect.objectContaining({name: 'db'}), match: null, target: null, __typename: 'Dependency'}])
        expect(store.getters.propertiesFromResourceType('WordPress').map(p => p.name)).toEqual(['title', 'admin'])
        expect(store.getters.dependenciesFromResourceType('Nope')).toEqual([])
        expect(store.getters.propertiesFromResourceType({})).toEqual([])
    })

    it('reads the blueprint\'s lists and schemas', async () => {
        const store = await loaded()
        expect(store.getters.getTemplatesList.map(t => t.name)).toEqual(['aws'])
        expect(store.getters.getPrimaryDeploymentBlueprint).toBe('aws')
        expect(store.getters.requirementsForType({name: 'WordPress'})).toHaveLength(1)
        expect(Object.keys(store.getters.inputsSchemaForType('WordPress').properties)).toEqual(['title', 'admin'])
        expect(store.getters.outputsSchemaForType('Compute')).toBeUndefined()
        expect(store.getters.blueprintRepositories).toHaveLength(2)
        expect(store.getters.blueprintResourceTypeDict).toHaveProperty('WordPress')
        expect(store.getters.applicationBlueprintIsLoaded).toBe(true)
        expect(store.getters.nestedTemplatesByPrimary).toEqual({})
        expect(store.getters.getApplicationRoot).toBe(store.state.blueprint)
    })
})

describe('blueprintFetchTypesWithParams', () => {
    it('merges in fetched types, keeping known icons and complete definitions', async () => {
        unfurlServerExport.mockResolvedValue(exportRoot())
        const {store} = makeStore()
        await store.dispatch('fetchProject', {projectPath: 'org/wp'})
        store.commit('setProjectState', {key: 'ResourceType', value: {WordPress: {...store.state.blueprint.ResourceType.WordPress, icon: 'wp.svg'}}})

        fetchTypeRepositories.mockResolvedValue({
            types: {
                WordPress: {name: 'WordPress', description: 'new'},
                Compute: {name: 'Compute', _sourceinfo: {incomplete: true}},
                Redis: {name: 'Redis'},
            },
            nestedTemplatesByPrimary: {WordPress: {shared: {}}},
        })

        await store.dispatch('blueprintFetchTypesWithParams', {params: {tempOnly: true}})

        const types = store.state.blueprint.ResourceType
        expect(types.WordPress).toMatchObject({description: 'new', icon: 'wp.svg'})
        expect(types.Compute._sourceinfo?.incomplete).toBeFalsy()
        expect(types).toHaveProperty('Redis')
        expect(store.getters.nestedTemplatesByPrimary).toEqual({WordPress: {shared: {}}})
    })

    it('reports a failed fetch', async () => {
        fetchTypeRepositories.mockRejectedValue(new Error('timeout'))
        const {store, recorded} = makeStore()
        await store.dispatch('blueprintFetchTypesWithParams', {params: {}})
        expect(recorded.errors[0]).toMatchObject({message: 'Load blueprint types: failed to fetch types (timeout)', severity: 'major'})
    })
})

describe('project state', () => {
    it('merges object values and replaces the rest', () => {
        const {store, state} = makeStore()
        store.commit('setProjectState', {key: 'ResourceType', value: {A: 1}})
        store.commit('setProjectState', {key: 'ResourceType', value: {B: 2}})
        store.commit('setProjectStateBatch', [{key: 'repositories', value: {r: {}}}, {key: 'ResourceType', value: {C: 3}}])
        expect(state.ResourceType).toEqual({A: 1, B: 2, C: 3})
        expect(state.clean).toBe(false)
    })

    it('resets to clean, and starts over when a different blueprint loads', async () => {
        const {store, recorded, state} = makeStore()
        store.commit('setProjectState', {key: 'ResourceType', value: {Old: {}}})
        store.commit('resetProjectState')
        expect(state).toMatchObject({loaded: false, callbacks: [], clean: true, ResourceType: null})

        store.commit('setProjectState', {key: 'ResourceType', value: {Old: {}}})
        unfurlServerExport.mockResolvedValue(exportRoot())
        await store.dispatch('fetchProject', {projectPath: 'org/wp'})
        expect(recorded.cleared).toBe(1)
        expect(state.ResourceType).not.toHaveProperty('Old')
    })

    // committed by template_resources when a type comes from an incomplete repository
    it('adds a temporary repository for later type fetches', async () => {
        unfurlServerExport.mockResolvedValue(exportRoot())
        const {store} = makeStore()
        await store.dispatch('fetchProject', {projectPath: 'org/wp'})
        store.commit('addTempRepository', {url: 'https://x/extra.git', file: 'e.yaml'})
        expect(store.getters.blueprintRepositories).toContainEqual({url: 'https://x/extra.git', file: 'e.yaml', temp: true})
    })

    it('runs a loaded callback straight away once loaded, and refuses a non-function', () => {
        const {store} = makeStore()
        store.commit('loaded', true)
        const cb = jest.fn()
        store.commit('onApplicationBlueprintLoaded', cb)
        expect(cb).toHaveBeenCalled()

        store.commit('loaded', false)
        store.commit('onApplicationBlueprintLoaded', 'nope')
        expect(() => store.commit('loaded', true)).toThrow('application blueprint callback is not a function')
    })
})
