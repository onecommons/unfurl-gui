// The patch builders, serializers and update requests. Save failures are in
// deployment_template_updates.save.test.js.
import {patchEnv} from 'oc_vue_shared/client_utils/envvars'
import {fetchProjectInfo, getOrFetchCurrentBranch, createBranch} from 'oc_vue_shared/client_utils/projects'
import {fetchUserAccessToken} from 'oc_vue_shared/client_utils/user'
import {unfurlServerUpdate} from 'oc_vue_shared/client_utils/unfurl-server'
import store, {
    UPDATE_TYPE,
    updatePropertyInInstance, createEnvironmentInstance, deleteEnvironmentInstance,
    updatePropertyInResourceTemplate, appendResourceTemplateInDT, deleteResourceTemplateInDT,
    appendDeploymentTemplateInBlueprint, deleteDeploymentTemplate, deleteResourceTemplate,
    appendResourceTemplateInDependent, deleteResourceTemplateInDependent,
    createResourceTemplate, createResourceTemplateInDeploymentTemplate, createDeploymentTemplate,
} from './deployment_template_updates'

jest.mock('oc_vue_shared/client_utils/envvars', () => ({patchEnv: jest.fn()}))
jest.mock('oc_vue_shared/client_utils/projects', () => ({fetchProjectInfo: jest.fn(), getOrFetchCurrentBranch: jest.fn(), createBranch: jest.fn()}))
jest.mock('oc_vue_shared/client_utils/user', () => ({fetchUserAccessToken: jest.fn()}))
jest.mock('oc_vue_shared/client_utils/unfurl-server', () => ({unfurlServerUpdate: jest.fn()}))
jest.mock('oc_vue_shared/client_utils/environments', () => ({declareAvailableProviders: jest.fn()}))

const {mutations, actions, getters} = store

// the patches a builder produces, with nested builders applied the way applyMutations does
function apply(accumulator, ...builders) {
    const state = {...store.state(), accumulator, preparedMutations: builders}
    mutations.applyMutations(state)
    return state
}

const sensitiveSchema = {properties: {password: {sensitive: true}, size: {}, nested: {type: 'object', properties: {token: {sensitive: true}}}}}

beforeEach(() => jest.spyOn(console, 'warn').mockImplementation(() => {}))
afterEach(() => console.warn.mockRestore())

describe('environment instance builders', () => {
    const accumulator = () => ({
        ResourceType: {DNS: {name: 'DNS', inputsSchema: {properties: {zone: {default: 'example.com'}, ttl: {}}}}},
        DeploymentEnvironment: {prod: {
            name: 'prod',
            instances: {app: {name: 'app', dependencies: [{name: 'dns', match: null}], properties: []}},
            connections: {primary_provider: {name: 'primary_provider', properties: [{name: 'region', value: 'us'}]}},
        }},
    })

    it('creates an instance with its type\'s defaults, matched into its dependent', () => {
        const state = apply(accumulator(), createEnvironmentInstance({type: 'DNS', name: 'dns1', title: 'DNS', environmentName: 'prod', dependentName: 'app', dependentRequirement: 'dns', extra: 1}))
        const env = state.patches.DeploymentEnvironment.prod
        expect(env.instances.dns1).toMatchObject({type: 'DNS', properties: [{name: 'zone', value: 'example.com'}, {name: 'ttl', value: null}], dependencies: [], extra: 1})
        expect(env.instances.app.dependencies[0].match).toBe('dns1')
    })

    it('stores a sensitive property as a variable reference', () => {
        const state = apply(accumulator(), updatePropertyInInstance({environmentName: 'prod', templateName: 'app', propertyName: 'password', propertyValue: 'hunter2', inputsSchema: sensitiveSchema}))
        expect(state.patches.DeploymentEnvironment.app.instances.app.properties).toEqual([{name: 'password', value: {get_env: 'app__password'}}])
        expect(state.env).toEqual({app__password: 'hunter2'})
    })

    it('updates a connection\'s property in place', () => {
        const state = apply(accumulator(), updatePropertyInInstance({environmentName: 'prod', templateName: 'primary_provider', propertyName: 'size', propertyValue: 'big', inputsSchema: sensitiveSchema}))
        expect(state.accumulator.DeploymentEnvironment.prod.connections.primary_provider.properties).toEqual([{name: 'region', value: 'us'}, {name: 'size', value: 'big'}])
    })

    it('deletes an instance and clears its match, or else a connection', () => {
        const acc = accumulator()
        acc.DeploymentEnvironment.prod.instances.dns1 = {name: 'dns1'}
        acc.DeploymentEnvironment.prod.instances.app.dependencies[0].match = 'dns1'
        let state = apply(acc, deleteEnvironmentInstance({templateName: 'dns1', environmentName: 'prod', dependentName: 'app', dependentRequirement: 'dns'}))
        expect(state.patches.DeploymentEnvironment.prod.instances).not.toHaveProperty('dns1')
        expect(state.patches.DeploymentEnvironment.prod.instances.app.dependencies[0].match).toBeNull()

        state = apply(accumulator(), deleteEnvironmentInstance({templateName: 'primary_provider', environmentName: 'prod'}))
        expect(state.patches.DeploymentEnvironment.prod.connections).not.toHaveProperty('primary_provider')
    })
})

describe('resource template builders', () => {
    const accumulator = () => ({
        ResourceType: {DB: {name: 'DB', inputsSchema: {properties: {size: {default: 'small'}}}, requirements: [{name: 'host', match: 'vm'}]}},
        ApplicationBlueprint: {bp: {name: 'bp', deploymentTemplates: ['aws']}},
        DeploymentTemplate: {
            aws: {name: 'aws', resourceTemplates: ['app'], ResourceTemplate: {}},
            fromSource: {name: 'fromSource', _sourceTemplate: 'base', resourceTemplates: [], ResourceTemplate: {local: {name: 'local', dependencies: [{name: 'db'}], properties: [{name: 'size', value: 'x'}]}}},
        },
        ResourceTemplate: {app: {name: 'app', dependencies: [{name: 'db', match: null}], properties: [{name: 'password', value: null}, {name: 'size', value: 'small'}]}},
    })

    it('creates a template from its type, added to its deployment template and dependent', () => {
        const state = apply(accumulator(), createResourceTemplate({type: 'DB', name: 'db1', title: 'Database', deploymentTemplateName: 'aws', dependentName: 'app', dependentRequirement: 'db'}))
        expect(state.patches.ResourceTemplate.db1).toMatchObject({
            type: 'DB', __typename: 'ResourceTemplate',
            properties: [{name: 'size', value: 'small'}],
            dependencies: [{name: 'host', match: 'vm', target: null, __typename: 'Dependency'}],
        })
        expect(state.patches.DeploymentTemplate.aws.resourceTemplates).toEqual(['app', 'db1'])
        expect(state.patches.ResourceTemplate.app.dependencies[0].match).toBe('db1')
    })

    it('creates a template local to a deployment template', () => {
        const state = apply(accumulator(), createResourceTemplateInDeploymentTemplate({type: {name: 'DB'}, name: 'db2', deploymentTemplateName: 'aws', properties: [], dependencies: []}))
        expect(state.patches.DeploymentTemplate.db2.ResourceTemplate.db2).toMatchObject({type: 'DB', __typename: 'ResourceTemplate'})
    })

    it('stores a sensitive template property as a deployment-scoped variable', () => {
        const state = apply(accumulator(), updatePropertyInResourceTemplate({templateName: 'app', propertyName: 'password', propertyValue: 'pw', deploymentName: 'aws', inputsSchema: sensitiveSchema}))
        expect(state.patches.ResourceTemplate.app.properties[0]).toEqual({name: 'password', value: {get_env: 'aws__app__password'}})
        expect(state.env).toEqual({aws__app__password: 'pw'})
    })

    it('destroys the variable for a cleared sensitive property', () => {
        const state = apply(accumulator(), updatePropertyInResourceTemplate({templateName: 'app', propertyName: 'password', propertyValue: null, deploymentName: 'aws', inputsSchema: sensitiveSchema}))
        expect(state.patches.ResourceTemplate.app.properties[0].value).toEqual({__deleted: true})
        expect(state.env).toEqual({aws__app__password: {_destroy: true}})
    })

    it('handles a nested sensitive property', () => {
        const acc = accumulator()
        acc.ResourceTemplate.app.properties.push({name: 'nested', value: null})
        const state = apply(acc, updatePropertyInResourceTemplate({templateName: 'app', propertyName: 'nested', propertyValue: {token: 't'}, deploymentName: 'aws', inputsSchema: sensitiveSchema}))
        expect(state.patches.ResourceTemplate.app.properties.find(p => p.name == 'nested').value).toEqual({token: {get_env: 'aws__app__nested_token'}})
        expect(state.env).toEqual({aws__app__nested_token: 't'})
    })

    it('moves a template out of a deployment template copied from a source before editing it', () => {
        const state = apply(accumulator(), updatePropertyInResourceTemplate({templateName: 'local', propertyName: 'size', propertyValue: 'big', deploymentName: 'fromSource', inputsSchema: sensitiveSchema}))
        expect(state.patches.DeploymentTemplate.fromSource.ResourceTemplate).not.toHaveProperty('local')
        expect(state.patches.ResourceTemplate.local).toMatchObject({_local: false, properties: [{name: 'size', value: 'big'}]})
    })

    it('edits a local template in place otherwise', () => {
        const acc = accumulator()
        acc.DeploymentTemplate.aws.ResourceTemplate.inner = {name: 'inner', properties: [{name: 'size', value: 'x'}]}
        const state = apply(acc, updatePropertyInResourceTemplate({templateName: 'inner', propertyName: 'size', propertyValue: 'y', deploymentName: 'aws', inputsSchema: sensitiveSchema}))
        expect(state.accumulator.DeploymentTemplate.aws.ResourceTemplate.inner.properties[0].value).toBe('y')
    })

    it('deletes a template, from its deployment template and dependent too', () => {
        const acc = accumulator()
        acc.ResourceTemplate.app.dependencies[0].match = 'db1'
        acc.DeploymentTemplate.aws.resourceTemplates.push('db1')
        const state = apply(acc, deleteResourceTemplate({templateName: 'db1', deploymentTemplateName: 'aws', dependentName: 'app', dependentRequirement: 'db'}))
        expect(state.patches.ResourceTemplate.db1).toBeNull()
        expect(state.patches.DeploymentTemplate.aws.resourceTemplates).toEqual(['app'])
        expect(state.patches.ResourceTemplate.app.dependencies[0].match).toBeNull()
    })

    it('deletes a local template from its deployment template', () => {
        const state = apply(accumulator(), deleteResourceTemplate({templateName: 'local', deploymentTemplateName: 'fromSource'}))
        expect(state.patches.DeploymentTemplate.fromSource.ResourceTemplate).toEqual({})
    })

    it('matches a local dependent through its deployment template', () => {
        const acc = accumulator()
        acc.DeploymentTemplate.aws.ResourceTemplate.inner = {name: 'inner', _local: true, dependencies: [{name: 'db', match: null}]}
        const state = apply(acc, appendResourceTemplateInDependent({templateName: 'db1', dependentName: 'inner', dependentRequirement: 'db', deploymentTemplateName: 'aws'}))
        expect(state.patches.DeploymentTemplate.aws.ResourceTemplate.inner.dependencies[0].match).toBe('db1')
    })

    it('unmatches a dependent, local or not', () => {
        const acc = accumulator()
        acc.DeploymentTemplate.aws.ResourceTemplate.inner = {name: 'inner', dependencies: [{name: 'db', match: 'x'}]}
        let state = apply(acc, deleteResourceTemplateInDependent({dependentName: 'inner', dependentRequirement: 'db', deploymentTemplateName: 'aws'}))
        expect(state.accumulator.DeploymentTemplate.aws.ResourceTemplate.inner.dependencies[0].match).toBeNull()

        state = apply(accumulator(), deleteResourceTemplateInDependent({dependentName: 'missing', dependentRequirement: 'db', deploymentTemplateName: 'aws'}))
        expect(state.patches).toEqual({})
    })

    it('keeps a deployment template\'s template list', () => {
        let state = apply(accumulator(), appendResourceTemplateInDT({templateName: 'x', deploymentTemplateName: 'new'}))
        expect(state.patches.DeploymentTemplate.new.resourceTemplates).toEqual(['x'])
        state = apply(accumulator(), deleteResourceTemplateInDT({templateName: 'app', deploymentTemplateName: 'aws'}))
        expect(state.patches.DeploymentTemplate.aws.resourceTemplates).toEqual([])
    })
})

describe('deployment template builders', () => {
    const accumulator = () => ({
        ResourceType: {App: {name: 'App'}},
        ApplicationBlueprint: {bp: {name: 'bp', deploymentTemplates: ['aws']}},
        DeploymentTemplate: {aws: {name: 'aws', blueprint: 'bp', resourceTemplates: ['app']}},
        ResourceTemplate: {app: {name: 'app'}},
    })

    it('creates a deployment template with its primary, added to the blueprint', () => {
        const state = apply(accumulator(), createDeploymentTemplate({blueprintName: 'bp', primary: 'App', primaryType: 'App', name: 'gcp', title: 'GCP'}))
        expect(state.patches.DeploymentTemplate.gcp).toMatchObject({primary: 'gcp-app', blueprint: 'bp', slug: 'gcp', resourceTemplates: ['gcp-app']})
        expect(state.patches.ResourceTemplate['gcp-app']).toMatchObject({type: 'App', title: 'App'})
        expect(state.patches.ApplicationBlueprint.bp.deploymentTemplates).toEqual(['aws', 'gcp'])
    })

    it('refuses one without a blueprint or name', () => {
        expect(() => createDeploymentTemplate({name: 'x'})).toThrow('Expected valid blueprintName')
        expect(() => createDeploymentTemplate({blueprintName: 'bp'})).toThrow('Expected valid name')
    })

    it('deletes a deployment template that lists no templates, from the blueprint', () => {
        const acc = accumulator()
        acc.DeploymentTemplate.aws.resourceTemplates = []
        const state = apply(acc, deleteDeploymentTemplate({name: 'aws'}))
        expect(state.patches.DeploymentTemplate.aws).toBeNull()
        expect(state.patches.ApplicationBlueprint.bp.deploymentTemplates).toEqual([])
    })

    // KNOWN BUG, pinned rather than fixed: each listed template is deleted with
    // no deploymentTemplateName, and deleteResourceTemplate reads
    // DeploymentTemplate[undefined]. Fixing it would also null top-level
    // templates other deployment templates may share.
    it('throws deleting a deployment template that lists templates', () => {
        expect(() => apply(accumulator(), deleteDeploymentTemplate({name: 'aws'}))).toThrow(TypeError)
    })

    it('does nothing to a blueprint it cannot find', () => {
        jest.spyOn(console, 'error').mockImplementation(() => {})
        const state = apply({}, appendDeploymentTemplateInBlueprint({templateName: 'x'}))
        expect(state.patches).toEqual({})
        console.error.mockRestore()
    })
})

describe('serializing patches', () => {
    const serialize = (patches, accumulator = {}) => {
        const state = {...store.state(), patches, accumulator}
        mutations.normalizePatches(state)
        return state.patches
    }

    it('moves the primary provider and cloud accounts into connections, and drops what defaults declare', () => {
        const {DeploymentEnvironment: {prod}} = serialize({DeploymentEnvironment: {prod: {
            name: 'prod',
            instances: [
                {name: 'primary_provider', type: 'Other'},
                {name: 'aws', type: 'unfurl.relationships.ConnectsTo.AWSAccount'},
                {name: 'shared', type: 'X'},
                {name: 'mine', type: 'X'},
            ],
            connections: {},
            ignored: 'dropped',
        }}}, {DeploymentEnvironment: {defaults: {instances: {shared: {}}}}})

        expect(Object.keys(prod.connections)).toEqual(['primary_provider', 'aws'])
        expect(Object.keys(prod.instances)).toEqual(['mine'])
        expect(prod.ignored).toBeUndefined()
    })

    it('cleans a resource template for committing', () => {
        const {ResourceTemplate: {app}} = serialize({ResourceTemplate: {app: {
            name: 'app', _local: true, __typename: 'ResourceTemplate', _sourceinfo: {file: 'a'}, visibility: 'visible',
            dependencies: [
                {name: 'db', match: 'db1', _ancestors: [], constraint: {name: 'db', _utilization: 1}},
                {name: 'unmatched', constraint: {}},
            ],
            properties: [{name: 'a', value: 1}, {name: 'b', value: null}, {name: 'c', value: {x: null, y: 2}}],
            computedProperties: [{name: 'url', value: 'u'}],
        }}})

        expect(app).not.toHaveProperty('_local')
        expect(app._sourceinfo).toEqual({file: 'a'})
        expect(app.visibility).toBeUndefined()
        expect(app.dependencies).toEqual([{name: 'db', match: 'db1', constraint: {name: 'db', visibility: 'visible'}}])
        // the "check deep" pass walks each property's own fields, so a null
        // inside a value survives
        expect(app.properties).toEqual([{name: 'a', value: 1}, {name: 'c', value: {x: null, y: 2}}, {name: 'url', value: 'u'}])
    })

    it('records hidden visibility in metadata', () => {
        const {ResourceTemplate: {app}} = serialize({ResourceTemplate: {app: {name: 'app', visibility: 'hidden', dependencies: [], properties: []}}})
        expect(app.metadata).toEqual({visibility: 'hidden'})
    })

    it('keeps only the selection of a selected template', () => {
        const {ResourceTemplate: {shared}} = serialize({ResourceTemplate: {shared: {name: 'shared', directives: ['select'], imported: 'd:t', type: 'T', properties: [1]}}})
        expect(shared.properties).toBeUndefined()
        expect(shared.imported).toBe('d:t')
    })

    it('turns a shared resource into a selection of it', () => {
        const {ResourceTemplate: {web}} = serialize({ResourceTemplate: {web: {name: 'web', __typename: 'Resource', _deployment: 'app', template: 'web-t', _type: {name: 'Container'}, title: 'Web', attributes: []}}})
        expect(web).toEqual({name: 'web', extends: undefined, metadata: undefined, title: 'Web', directives: ['select'], imported: 'app:web-t', type: 'Container', __typename: 'ResourceTemplate'})
    })

    it('drops a substitute\'s requirement that matches an uncommitted sibling', () => {
        const {ResourceTemplate: {sub}} = serialize(
            {ResourceTemplate: {sub: {name: 'sub', directives: ['substitute'], dependencies: [{name: 'a', match: 'b', constraint: {}}, {name: 'b', match: 'x', constraint: {}}], properties: []}}},
            {ResourceTemplate: {x: {}}},
        )
        expect(sub.dependencies.map(d => d.name)).toEqual(['b'])
    })

    it('lists a deployment template\'s templates and marks a generated one predefined', () => {
        const {DeploymentTemplate: {dt}} = serialize(
            {DeploymentTemplate: {dt: {name: 'dt', source: '__generated', ResourceTemplate: {local: {name: 'local', dependencies: [], properties: []}}}}},
            {ResourceTemplate: {top: {}}},
        )
        expect(dt.resourceTemplates).toEqual(['local', 'top'])
        expect(dt.directives).toEqual(['predefined'])
    })

    it('leaves frozen records alone and drops DefaultTemplate', () => {
        const frozen = Object.freeze({name: 'f', _x: 1})
        const patches = serialize({ResourceTemplate: {f: frozen}, DefaultTemplate: {d: {}}})
        expect(patches.ResourceTemplate.f).toBe(frozen)
        expect(patches).not.toHaveProperty('DefaultTemplate')
    })
})

describe('staging changes', () => {
    it('applies prepared mutations, keeping them for a dry run', () => {
        const state = {...store.state(), accumulator: {}}
        mutations.pushPreparedMutation(state, () => [{typename: 'X', target: 'a', patch: {v: 1}, env: {E: '1'}}])
        expect(getters.hasPreparedMutations(state)).toBe(true)

        mutations.applyMutations(state, {dryRun: true})
        expect(state.patches.X.a).toEqual({v: 1})
        expect(state.env).toEqual({E: '1'})
        expect(state.preparedMutations).toHaveLength(1)

        mutations.applyMutations(state)
        expect(state.preparedMutations).toEqual([])
    })

    it('can disregard mutations staged so far', () => {
        const state = store.state()
        mutations.pushPreparedMutation(state, () => [])
        mutations.clientDisregardUncommitted(state)
        expect(getters.hasPreparedMutations(state)).toBe(false)
        expect(getters.safeToNavigateAway(state, {hasPreparedMutations: false})).toBe(true)
    })

    it('records what is already committed from a base state', () => {
        const state = store.state()
        mutations.setBaseState(state, {ResourceTemplate: {a: {}}, DeploymentEnvironment: {prod: {}}, ResourceType: {T: {}}})
        expect(getters.isCommittedName(state)('ResourceTemplate', 'a')).toBe(true)
        expect(getters.isCommittedName(state)('ResourceType', 'T')).toBe(false)
        mutations.useBaseState(state, {})
        expect(state.useBaseState).toBe(true)
    })

    it('resets, keeping the target for a dry run', () => {
        const state = {...store.state(), path: 'p', commitMessage: 'm', patches: {X: {}}, preparedMutations: [() => []]}
        mutations.resetStagedChanges(state, {dryRun: true})
        expect(state).toMatchObject({patches: {}, path: 'p', commitMessage: 'm'})
        mutations.resetStagedChanges(state)
        expect(state).toMatchObject({path: undefined, commitMessage: null, preparedMutations: []})
    })

    it('keeps the commit target fields', () => {
        const state = store.state()
        mutations.setUpdateObjectPath(state, 'environments/prod/app')
        mutations.setUpdateObjectProjectPath(state, 'org/dash')
        mutations.setCommitMessage(state, 'msg')
        mutations.setEnvironmentScope(state, 'prod')
        mutations.setCommitBranchIsNew(state, true)
        mutations.setCommitBranch(state, 'feature')
        mutations.setBlueprintBranch(state, 'main')
        mutations.setDeploymentParams(state, {a: 1})
        mutations.setUpdateType(state, 'deployment')
        expect(state).toMatchObject({path: 'environments/prod/app', projectPath: 'org/dash', commitMessage: 'msg', environmentScope: 'prod', commitBranch: 'feature', commitBranchIsNew: false, blueprintBranch: 'main', updateType: 'deployment'})
        expect(getters.getCommitBranch(state)).toBe('feature')
    })

    it('refuses a new target while committing', () => {
        const state = {...store.state(), preparedMutations: [() => []], isCommitting: true}
        expect(() => mutations.setUpdateObjectPath(state, 'x')).toThrow('Cannot update path while committing')
        expect(() => mutations.setUpdateObjectProjectPath(state, 'x')).toThrow('Cannot update projectPath while committing')
    })
})

describe('sendUpdateSubrequests', () => {
    const context = (state, rootGetters = {}) => ({
        state: {...store.state(), env: {}, environmentScope: 'prod', projectPath: 'org/dash', commitBranch: 'main', ...state},
        getters: {
            getPatches: state.patches || {ResourceTemplate: {app: {name: 'app'}, gone: null}},
            isCommittedName: () => true,
        },
        rootState: {},
        rootGetters: {lookupVariableByEnvironment: () => 'tok', hasDeployPathKey: () => true, ...rootGetters},
        commit: jest.fn(),
    })

    beforeEach(() => {
        patchEnv.mockResolvedValue(null)
        fetchProjectInfo.mockResolvedValue({id: 7})
        unfurlServerUpdate.mockResolvedValue({})
        window.gon = {}
    })

    it('updates an existing deployment with the variables url', async () => {
        const ctx = context({updateType: UPDATE_TYPE.deployment, path: 'environments/prod/app'})
        await actions.sendUpdateSubrequests(ctx)

        expect(unfurlServerUpdate).toHaveBeenCalledWith(expect.objectContaining({
            method: 'update_ensemble', branch: 'main',
            patch: [{name: 'app', __typename: 'ResourceTemplate'}, {__deleted: true, name: 'gone', __typename: 'ResourceTemplate'}],
            variables: expect.objectContaining({deployment_path: 'environments/prod/app', cloud_vars_url: expect.stringContaining('/api/v4/projects/7/variables')}),
        }))
    })

    it('creates a new deployment from its blueprint, with the user\'s token', async () => {
        fetchUserAccessToken.mockResolvedValue('pat')
        const ctx = context({
            updateType: UPDATE_TYPE.deployment, path: 'environments/prod/new',
            deploymentParams: {environmentName: 'prod', deploymentBlueprint: 'aws', projectUrl: 'https://gitlab.example/org/bp.git'},
        }, {hasDeployPathKey: () => false})

        await actions.sendUpdateSubrequests(ctx)

        expect(unfurlServerUpdate.mock.calls[0][0]).toMatchObject({
            method: 'create_ensemble',
            variables: {environment: 'prod', deployment_blueprint: 'aws', blueprint_url: 'https://:pat@gitlab.example/org/bp.git'},
        })
    })

    it.each([
        [UPDATE_TYPE.blueprint, 'update_ensemble', {deployment_path: 'ensemble-template.yaml'}],
        [UPDATE_TYPE.deleteDeployment, 'delete_deployment', {}],
        [UPDATE_TYPE.deleteEnvironment, 'delete_environment', {}],
    ])('sends %s as %s', async (updateType, method, variables) => {
        const ctx = context({updateType, path: null}, {lookupVariableByEnvironment: () => null})
        await actions.sendUpdateSubrequests(ctx)
        expect(unfurlServerUpdate.mock.calls[0][0]).toMatchObject({method, variables})
    })

    it('leaves an untouched provider\'s empty directives out of an environment', async () => {
        const directives = []
        const ctx = context({
            updateType: UPDATE_TYPE.environment,
            patches: {DeploymentEnvironment: {prod: {connections: {p: {name: 'p', directives}, q: {name: 'q', directives: ['x']}}}}},
        }, {lookupVariableByEnvironment: () => null})

        await actions.sendUpdateSubrequests(ctx)

        const [env] = unfurlServerUpdate.mock.calls[0][0].patch
        expect(env.connections.p).toEqual({name: 'p'})
        expect(env.connections.q.directives).toEqual(['x'])
    })

    it('posts the variables first and aborts if that fails', async () => {
        patchEnv.mockRejectedValue(new Error('403'))
        const ctx = context({updateType: UPDATE_TYPE.deployment, env: {A: '1'}})
        await actions.sendUpdateSubrequests(ctx)
        expect(patchEnv).toHaveBeenCalledWith({A: '1'}, 'prod', 'org/dash', 0)
        expect(ctx.commit).toHaveBeenCalledWith('createError', expect.objectContaining({message: 'Failed to update secrets -- aborting commit (403)'}), {root: true})
        expect(unfurlServerUpdate).not.toHaveBeenCalled()
    })

    it('creates a new branch before writing to it', async () => {
        getOrFetchCurrentBranch.mockResolvedValue('main')
        const ctx = context({updateType: UPDATE_TYPE.deployment, commitBranch: 'feature', commitBranchIsNew: true})
        await actions.sendUpdateSubrequests(ctx)
        expect(createBranch).toHaveBeenCalledWith('org%2Fdash', 'feature')
        expect(ctx.commit).toHaveBeenCalledWith('setCommitBranchIsNew', false)
    })

    it('returns the patch without sending on a dry run', async () => {
        const log = jest.spyOn(console, 'log').mockImplementation(() => {})
        const ctx = context({updateType: UPDATE_TYPE.deployment})
        const result = await actions.sendUpdateSubrequests(ctx, {dryRun: true})
        expect(result.patch).toHaveLength(2)
        expect(patchEnv).not.toHaveBeenCalled()
        expect(unfurlServerUpdate).not.toHaveBeenCalled()
        log.mockRestore()
    })

    it('takes a copy of the application root as its base', async () => {
        const commit = jest.fn()
        const root = {ResourceTemplate: {a: {}}}
        await actions.fetchRoot({commit, rootGetters: {getApplicationRoot: root}})
        expect(commit.mock.calls[0][0]).toBe('setBaseState')
        expect(commit.mock.calls[0][1]).toEqual(root)
        expect(commit.mock.calls[0][1]).not.toBe(root)
    })
})
