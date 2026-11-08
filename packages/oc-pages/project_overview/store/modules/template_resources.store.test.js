// template_resources in a store with the real modules it works through
// (blueprint, environments, deployments, updates, errors); only the network is mocked.
import Vuex from 'vuex'
import {unfurlServerExport, fetchTypeRepositories} from 'oc_vue_shared/client_utils/unfurl-server'
import {fetchLastCommit} from 'oc_vue_shared/client_utils/projects'
import templateResources from './template_resources'
import blueprint from './project_application_blueprint'
import environments from './environments'
import deployments from './deployments'
import updates from './deployment_template_updates'
import errors from 'oc_vue_shared/store_modules/errors'

jest.mock('oc_vue_shared/client_utils/unfurl-server', () => ({
    ...jest.requireActual('oc_vue_shared/client_utils/unfurl-server'),
    unfurlServerExport: jest.fn(), fetchTypeRepositories: jest.fn(), unfurlServerUpdate: jest.fn(), awaitQueuedWrite: jest.fn(),
}))
jest.mock('oc_vue_shared/client_utils/projects', () => ({
    ...jest.requireActual('oc_vue_shared/client_utils/projects'),
    fetchLastCommit: jest.fn(), fetchProjectInfo: jest.fn(), getOrFetchCurrentBranch: jest.fn(),
}))

const DB_TYPE = {name: 'DB', title: 'Database', extends: ['DB', 'Store'], implementations: ['create'], implementation_requirements: [], inputsSchema: {properties: {size: {default: 'small'}}}, requirements: [], metadata: {}, _sourceinfo: {file: 'db.yaml'}}

// a blueprint: the app needs a database (matched to the_db) and optionally a cache
const exportRoot = () => ({
    ApplicationBlueprint: {wp: {name: 'wp', primary: 'App', deploymentTemplates: ['aws']}},
    ResourceType: {
        App: {name: 'App', extends: ['App'], implementations: ['create'], implementation_requirements: [], inputsSchema: {properties: {title: {}}}, requirements: [{name: 'db', resourceType: 'Store', min: 1, max: 1}, {name: 'cache', resourceType: 'Cache', min: 0, max: 1}]},
        DB: DB_TYPE,
        Redis: {name: 'Redis', extends: ['Cache'], implementations: ['create'], implementation_requirements: [], inputsSchema: {properties: {}}, requirements: [], metadata: {}},
        OldCache: {name: 'OldCache', extends: ['Cache'], implementations: ['create'], implementation_requirements: [], inputsSchema: {properties: {}}, requirements: [], metadata: {}},
        NewCache: {name: 'NewCache', extends: ['Cache'], implementations: ['create'], implementation_requirements: [], inputsSchema: {properties: {}}, requirements: [], metadata: {deprecates: ['OldCache']}},
    },
    ResourceTemplate: {
        the_app: {name: 'the_app', type: 'App', directives: [], properties: [{name: 'title', value: 'Blog'}], dependencies: [
            {name: 'db', match: 'the_db', constraint: {name: 'db', resourceType: 'Store', min: 1, max: 1, visibility: 'visible'}},
            {name: 'cache', match: null, constraint: {name: 'cache', resourceType: 'Cache', min: 0, max: 1, visibility: 'visible'}},
        ]},
        the_db: {name: 'the_db', type: 'DB', directives: [], properties: [{name: 'size', value: 'small'}], dependencies: []},
    },
    DeploymentTemplate: {aws: {name: 'aws', title: 'AWS', primary: 'the_app', cloud: 'unfurl.relationships.ConnectsTo.AWSAccount', blueprint: 'wp', resourceTemplates: []}},
    repositories: {},
})

const prepared = store => {
    // apply the prepared mutations over the exported blueprint, as committing does, without sending
    store.commit('setBaseState', exportRoot())
    store.commit('applyMutations', {dryRun: true})
    return store.state.updates.patches
}

async function loadedStore({environment, root = exportRoot()} = {}) {
    unfurlServerExport.mockResolvedValue(root)
    fetchLastCommit.mockResolvedValue(['abc', 'main', 0, true])
    fetchTypeRepositories.mockResolvedValue({types: {}, nestedTemplatesByPrimary: {}})
    const store = new Vuex.Store({
        modules: {templates: templateResources, blueprint, environments, deployments, updates, errors},
        getters: {
            REVEAL_HIDDEN_TEMPLATES: () => false,
            getHomeProjectPath: () => 'org/dash',
            getCurrentNamespace: () => 'org',
            getUsername: () => 'me',
        },
    })
    await store.dispatch('fetchProject', {projectPath: 'org/wp'})
    if(environment) {
        store.commit('setProjectEnvironments', [environment])
        store.commit('setResourceTypeDictionary', {environment, dict: {}})
    }
    await store.dispatch('populateTemplateResources', {
        projectPath: 'org/wp', templateSlug: 'aws', environmentName: environment?.name,
    })
    return store
}

beforeEach(() => {
    window.gon = {}
    jest.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => console.warn.mockRestore())

describe('populating a deployment template', () => {
    it('puts the primary and its matched templates on cards', async () => {
        const store = await loadedStore()
        const g = store.getters

        expect(g.getPrimaryCard.name).toBe('the_app')
        expect(g.getCardsStacked.map(c => c.name)).toEqual(['the_db'])
        expect(g.getDeploymentTemplate).toMatchObject({name: 'aws', projectPath: 'org/wp'})
        expect(g.getCurrentContext).toBe('blueprint')
        expect(g.lastFetchedFrom).toMatchObject({projectPath: 'org/wp', templateSlug: 'aws', sourceDeploymentTemplate: 'aws'})
        expect(g.primaryCardProperties).toEqual([{name: 'title', value: 'Blog'}])
        expect(g.getCardProperties('the_db')).toEqual([{name: 'size', value: 'small'}])
        expect(g.getCardType('the_db')).toBe('DB')
        expect(g.getCardExtends('the_db')).toEqual(['DB', 'Store'])
        expect(g.getDependencies('the_app').map(d => d.name)).toEqual(['db', 'cache'])
        expect(g.getDependenciesMatchingCard('the_db')).toHaveLength(1)
    })

    it('reads requirement matches and validity', async () => {
        const store = await loadedStore()
        const g = store.getters
        const [db, cache] = g.getDependencies('the_app')

        expect(g.resolveRequirementMatchTitle(db)).toBe('the_db')
        expect(g.requirementMatchIsValid(db)).toBe(true)
        expect(g.requirementMatchIsValid(cache)).toBe(false)
        expect(g.cardDependenciesAreValid('the_app')).toBe(true)
        expect(g.infallibleGetCardTitle('missing')).toBe('missing')
    })

    it('renames the deployment template when asked, staging it', async () => {
        const store = await loadedStore()
        await store.dispatch('populateTemplateResources', {
            projectPath: 'org/wp', templateSlug: 'aws', renameDeploymentTemplate: 'My Copy', syncState: true,
        })
        expect(store.getters.getDeploymentTemplate).toMatchObject({name: 'my-copy', title: 'My Copy', primary: 'the_app', _sourceTemplate: 'aws'})
        const patches = prepared(store)
        expect(patches.DeploymentTemplate['my-copy']).toMatchObject({name: 'my-copy'})
        expect(patches.ApplicationBlueprint.wp.deploymentTemplates).toEqual(['aws', 'my-copy'])
    })

    // KNOWN BUG: renamePrimary assigns to the template the blueprint store resolved,
    // which it froze. Nothing sets the ?rtn= query that supplies it.
    it('cannot rename the primary', async () => {
        const store = await loadedStore()
        await expect(store.dispatch('populateTemplateResources', {projectPath: 'org/wp', templateSlug: 'aws', renamePrimary: 'Main App'}))
            .rejects.toThrow("Cannot assign to read only property 'name'")
    })

    it('reports nothing loaded for an unknown template', async () => {
        const store = await loadedStore()
        await expect(store.dispatch('populateTemplateResources', {projectPath: 'org/wp', templateSlug: null})).resolves.toBe(false)
    })
})

describe('resource types', () => {
    it('offers the configurable types for a requirement, without deprecated ones', async () => {
        const store = await loadedStore()
        const g = store.getters
        const cache = g.getDependencies('the_app')[1]

        expect(g.availableResourceTypesForRequirement(cache).map(t => t.name).sort()).toEqual(['NewCache', 'Redis'])
        expect(g.availableResourceTypesForRequirement(cache, true).map(t => t.name).sort()).toEqual(['NewCache', 'Redis'])
        expect(g.availableResourceTypesForRequirement(null)).toEqual([])
        expect(g.instantiableResourceTypes.map(t => t.name)).not.toContain('OldCache')
    })

    it('prefers a complete type, carrying an icon from either source', async () => {
        const environment = {name: 'prod', primary_provider: {type: 'unfurl.relationships.ConnectsTo.AWSAccount'}, connections: {}, instances: {}}
        const store = await loadedStore({environment})
        store.commit('setResourceTypeDictionary', {environment, dict: {
            DB: {name: 'DB', icon: 'db.svg', _sourceinfo: {incomplete: true}},
            Sub: {name: 'Sub', directives: ['substitute']},
        }})
        const g = store.getters
        expect(g.resolveResourceTypeFromAny('DB')).toMatchObject({extends: ['DB', 'Store'], icon: 'db.svg'})
        expect(g.resolveResourceTypeFromAny('Sub').directives).toEqual(['substitute'])
        expect(g.resolveResourceTypeFromAny('Nope')).toBeNull()
    })

    it('narrows a template\'s input schema by its parent\'s constraint', async () => {
        const store = await loadedStore()
        const g = store.getters
        expect(Object.keys(g.resourceTemplateInputsSchema('the_db').properties)).toEqual(['size'])
        expect(g.resourceTemplateInputsSchema({type: 'DB', name: 'unloaded'}).properties).toHaveProperty('size')
        expect(() => g.resourceTemplateInputsSchema('nope', {strict: true})).toThrow("Resource template 'nope' not found")
    })
})

describe('creating a resource', () => {
    it('creates a node for a requirement, staged as a new template', async () => {
        const store = await loadedStore()
        const cache = store.getters.getDependencies('the_app')[1]

        await store.dispatch('createNodeResource', {
            dependentName: 'the_app', dependentRequirement: 'cache', requirement: cache.constraint,
            name: 'redis1', title: 'Redis', selection: store.getters.resolveResourceTypeFromAny('Redis'),
        })

        const card = store.state.templates.resourceTemplates.redis1
        expect(card).toMatchObject({name: 'redis1', title: 'Redis', __typename: 'ResourceTemplate', dependentName: 'the_app', dependentRequirement: 'cache', metadata: {created_by: 'unfurl-gui'}})
        expect(store.getters.getDependencies('the_app')[1]).toMatchObject({match: 'redis1', completionStatus: 'created'})
        expect(store.getters.getCardsStacked.map(c => c.name)).toEqual(['the_db', 'redis1'])

        const patches = prepared(store)
        expect(patches.ResourceTemplate.redis1).toMatchObject({type: 'Redis', __typename: 'ResourceTemplate'})
        expect(patches.ResourceTemplate.the_app.dependencies.find(d => d.name == 'cache').match).toBe('redis1')
    })

    it('deletes a created node, unmatching its dependent', async () => {
        const store = await loadedStore()
        const cache = store.getters.getDependencies('the_app')[1]
        await store.dispatch('createNodeResource', {
            dependentName: 'the_app', dependentRequirement: 'cache', requirement: cache.constraint,
            name: 'redis1', title: 'Redis', selection: store.getters.resolveResourceTypeFromAny('Redis'),
        })
        store.commit('clearPreparedMutations')

        await store.dispatch('deleteNode', {name: 'redis1', action: 'delete', dependentName: 'the_app', dependentRequirement: 'cache'})

        expect(store.state.templates.resourceTemplates).not.toHaveProperty('redis1')
        expect(store.getters.getDependencies('the_app')[1].match).toBeNull()
        expect(prepared(store).ResourceTemplate.redis1).toBeNull()
    })

    it('forgets a deleted node\'s input statuses', async () => {
        const store = await loadedStore()
        const cache = store.getters.getDependencies('the_app')[1]
        await store.dispatch('createNodeResource', {
            dependentName: 'the_app', dependentRequirement: 'cache', requirement: cache.constraint,
            name: 'redis1', title: 'Redis', selection: store.getters.resolveResourceTypeFromAny('Redis'),
        })
        store.commit('setInputValidStatus', {card: 'redis1', path: 'all', status: 'error'})
        await store.dispatch('deleteNode', {name: 'redis1', action: 'delete', dependentName: 'the_app', dependentRequirement: 'cache'})
        expect(store.getters.getValidationStatuses).not.toHaveProperty('redis1')
    })

    it('connects an environment\'s instance as a read-only copy', async () => {
        const environment = {name: 'prod', connections: {}, instances: {shared_db: {name: 'shared_db', type: 'DB', title: 'Shared DB', properties: [], dependencies: []}}}
        const store = await loadedStore({environment})

        await store.dispatch('connectNodeResource', {dependentName: 'the_app', dependentRequirement: 'cache', externalResource: 'shared_db'})

        expect(store.state.templates.resourceTemplates.__shared_db).toMatchObject({readonly: true, _external: true, title: 'Shared DB', directives: []})
        expect(store.getters.getDependencies('the_app')[1]).toMatchObject({match: '__shared_db', completionStatus: 'connected'})
        expect(prepared(store).ResourceTemplate.__shared_db).toMatchObject({name: '__shared_db'})
    })

    it('refuses to connect nothing', async () => {
        const store = await loadedStore()
        await expect(store.dispatch('connectNodeResource', {dependentName: 'the_app', dependentRequirement: 'cache'}))
            .rejects.toThrow('connectNodeResource must be called with either')
    })
})

describe('editing properties', () => {
    it('stages a changed property', async () => {
        const store = await loadedStore()
        await store.dispatch('updateProperty', {deploymentName: 'aws', templateName: 'the_db', propertyName: 'size', propertyValue: 'large'})
        expect(store.getters.lookupCardPropertyValue('the_db', 'size')).toBe('large')
        expect(prepared(store).ResourceTemplate.the_db.properties).toEqual([{name: 'size', value: 'large'}])
    })

    it('sets a nested value along a property path, and skips one unchanged', async () => {
        const store = await loadedStore()
        const set = port => store.dispatch('updateProperty', {deploymentName: 'aws', templateName: 'the_db', propertyName: 'port', propertyPath: ['opts', 'net'], propertyValue: port})
        await set(5432)
        expect(store.getters.lookupCardPropertyValue('the_db', 'opts')).toEqual({net: {port: 5432}})
        await set(5432)
        expect(store.state.updates.preparedMutations).toHaveLength(1)
    })

    // KNOWN BUG: the unchanged check looks the property up by propertyPath[0], which
    // is undefined without a path, so an unchanged top-level value is staged again.
    it('stages an unchanged top-level property', async () => {
        const store = await loadedStore()
        await store.dispatch('updateProperty', {deploymentName: 'aws', templateName: 'the_db', propertyName: 'size', propertyValue: 'small'})
        expect(store.state.updates.preparedMutations).toHaveLength(1)
    })

    it('debounces, keeping only the last change', async () => {
        jest.useFakeTimers()
        try {
            const store = await loadedStore()
            store.dispatch('updateProperty', {deploymentName: 'aws', templateName: 'the_db', propertyName: 'size', propertyValue: 'a', debounce: 100})
            store.dispatch('updateProperty', {deploymentName: 'aws', templateName: 'the_db', propertyName: 'size', propertyValue: 'b', debounce: 100})
            await jest.advanceTimersByTimeAsync(150)
            expect(store.getters.lookupCardPropertyValue('the_db', 'size')).toBe('b')
            expect(store.state.updates.preparedMutations).toHaveLength(1)
        } finally {
            jest.useRealTimers()
        }
    })

    it('tracks input validity per card', async () => {
        const store = await loadedStore()
        const g = store.getters
        expect(g.cardInputsAreValid('the_db')).toBe(true)

        await store.dispatch('updateCardInputValidStatus', {card: {name: 'the_db'}, status: 'missing'})
        expect(g.cardInputsAreValid('the_db')).toBe(false)
        expect(g.cardIsValid('the_app')).toBe(false)
        expect(g.deployTooltip).toBe('Some components are missing inputs')

        store.commit('setInputValidStatus', {card: 'the_db', path: 'all', status: 'error'})
        expect(g.deployTooltip).toBe('Some components have missing or invalid values')

        store.commit('setInputValidStatus', {card: 'the_db', path: 'all', status: 'valid'})
        store.commit('setInputValidStatus', {card: 'the_app', path: 'all', status: 'valid'})
        expect(g.deployTooltip).toBeNull()
    })
})

describe('visibility', () => {
    it('hides a template by its own visibility, or inherited from its constraint', async () => {
        const store = await loadedStore()
        const g = store.getters
        expect(g.cardIsHidden('the_db')).toBe(false)

        store.commit('createTemplateResource', {...store.state.templates.resourceTemplates.the_db, visibility: 'hidden'})
        expect(g.cardIsHidden('the_db')).toBe(true)
        expect(g.getCardsStacked).toEqual([])
        expect(g.getHiddenCardsStacked.map(c => c.name)).toEqual(['the_db'])
        expect(g.getHiddenCardsInTopology('the_app').map(c => c.name)).toEqual(['the_db'])
        expect(g.constraintIsHidden('the_app', 'db')).toBe(true)
    })

    it('groups cards by topology namespace', async () => {
        const store = await loadedStore()
        expect(store.getters.getCardsInTopology('the_app').map(c => c.name)).toEqual(['the_db'])
        expect(store.getters.getCardsInTopology('other')).toEqual([])
    })
})

describe('the environment editor', () => {
    it('shows an environment\'s instances, and its primary provider', async () => {
        const environment = {name: 'prod', connections: {}, instances: {dns: {name: 'dns', type: 'DB', properties: [], dependencies: []}}}
        const store = await loadedStore({environment})
        store.commit('setProjectState', {key: 'ResourceTemplate', value: {primary_provider: {name: 'primary_provider', type: 'unfurl.relationships.ConnectsTo.AWSAccount', properties: [{name: 'region'}]}}})

        await store.dispatch('populateEnvironmentResources', {resourceTemplates: [{name: 'dns'}, {name: 'primary_provider'}], environmentName: 'prod'})

        const g = store.getters
        expect(g.getCurrentContext).toBe('environment')
        expect(g.getCurrentEnvironmentName).toBe('prod')
        expect(g.getCardsStacked.map(c => c.name)).toEqual(['dns'])
        expect(store.state.templates.resourceTemplates.primary_provider).toMatchObject({title: 'Primary Provider', properties: [], _permanent: true})
    })
})

describe('mutations', () => {
    it('references a template from its dependent, and removes the reference', async () => {
        const store = await loadedStore()
        store.commit('createReference', {dependentName: 'the_app', dependentRequirement: 'cache', resourceTemplate: {name: 'c1'}, fieldsToReplace: {completionStatus: 'created'}, constraintFieldsToReplace: {extra: 1}})
        let cache = store.state.templates.resourceTemplates.the_app.dependencies[1]
        expect(cache).toMatchObject({match: 'c1', completionStatus: 'created', constraint: {extra: 1}})

        store.commit('deleteReference', {dependentName: 'the_app', dependentRequirement: 'cache'})
        cache = store.state.templates.resourceTemplates.the_app.dependencies[1]
        expect(cache).toMatchObject({match: null, completionStatus: null, _valid: false, constraint: {match: null}})
    })

    it('adds an unknown property rather than dropping it', async () => {
        const store = await loadedStore()
        store.commit('templateUpdateProperty', {templateName: 'the_db', propertyName: 'extra', propertyValue: 1})
        expect(store.getters.getCardProperties('the_db')).toEqual([{name: 'size', value: 'small'}, {name: 'extra', value: 1}])
    })

    it('resets to an empty editor', async () => {
        const store = await loadedStore()
        store.commit('resetTemplateResourceState')
        expect(store.state.templates.resourceTemplates).toEqual({})
        expect(store.getters.getPrimaryCard).toEqual({})
    })
})

describe('removal planning', () => {
    it('removes generated dependencies along with their only dependent', async () => {
        const store = await loadedStore()
        const cache = store.getters.getDependencies('the_app')[1]
        await store.dispatch('createNodeResource', {
            dependentName: 'the_app', dependentRequirement: 'cache', requirement: cache.constraint,
            name: 'redis1', title: 'Redis', selection: store.getters.resolveResourceTypeFromAny('Redis'),
        })
        expect(store.getters.dependenciesRemovableWith('the_app')).toEqual(['redis1'])
        expect(store.getters.directAncestors('redis1').map(c => c.name)).toEqual(['the_app'])
    })
})

describe('environment lookups', () => {
    it('reads a variable from the environment, then shared ones', async () => {
        const environment = {name: 'prod', connections: {}, instances: {}}
        const store = await loadedStore({environment})
        store.commit('setVariablesByEnvironment', {prod: {A: 'p'}, '*': {B: 's'}})
        expect(store.getters.lookupEnvironmentVariable('A')).toBe('p')
        expect(store.getters.lookupEnvironmentVariable(['B'])).toBe('s')
        expect(store.getters.getCurrentEnvironment.name).toBe('prod')
    })

    it('scopes repositories to the blueprint and environment', async () => {
        const environment = {name: 'prod', connections: {}, instances: {}, repositories: {std: {url: 'https://unfurl.cloud/onecommons/std.git'}}}
        const store = await loadedStore({environment})
        expect(store.getters.repositoryInScope({url: 'https://unfurl.cloud/onecommons/std.git'})).toBe(true)
        expect(store.getters.repositoryInScope({url: 'https://unfurl.cloud/other/x.git'})).toBe(false)
        // a path that isn't a URL reads as no repository, so it matches only another such path
        expect(store.getters.repositoryInScope({url: '/local/path'})).toBe(false)
    })
})

describe('auto-created dependencies', () => {
    // a required queue with one implementation that asks nothing of the user
    const withQueue = () => {
        const root = exportRoot()
        root.ResourceType.App.requirements.push({name: 'queue', resourceType: 'Queue', min: 1, max: 1})
        root.ResourceType.Rabbit = {name: 'Rabbit', extends: ['Queue'], implementations: ['create'], implementation_requirements: [], inputsSchema: {properties: {}}, requirements: [], metadata: {}}
        root.ResourceTemplate.the_app.dependencies.push({name: 'queue', match: null, constraint: {name: 'queue', resourceType: 'Queue', min: 1, max: 1, visibility: 'visible'}})
        return root
    }

    it('creates a hidden node for a required dependency with one inputless type', async () => {
        const store = await loadedStore({root: withQueue()})
        expect(store.state.templates.resourceTemplates['queue-for-the_app']).toMatchObject({visibility: 'hidden', type: 'Rabbit', dependentName: 'the_app'})
        expect(store.getters.getDependencies('the_app')[2].match).toBe('queue-for-the_app')
    })

    it('leaves it to the user when the type has inputs', async () => {
        const root = withQueue()
        root.ResourceType.Rabbit.inputsSchema.properties.vhost = {}
        const store = await loadedStore({root})
        expect(store.state.templates.resourceTemplates).not.toHaveProperty('queue-for-the_app')
    })
})

describe('the deployment page', () => {
    const deployed = () => {
        const root = exportRoot()
        root.Resource = {
            app_r: {name: 'app_r', __typename: 'Resource', template: 'the_app', attributes: [{name: 'title', value: 'Blog'}], connections: [{name: 'db', target: 'db_r'}]},
            db_r: {name: 'db_r', __typename: 'Resource', template: 'the_db', attributes: [], connections: []},
            log_r: {name: 'log_r', __typename: 'Resource', template: 'the_db', attributes: [], connections: [], visibility: 'hidden'},
        }
        root.Deployment = {dep1: {name: 'dep1', __typename: 'Deployment', deploymentTemplate: 'aws', primary: 'app_r', workflow: 'deploy'}}
        return root
    }

    it('shows a deployment\'s resources, the primary aside and hidden ones left out', async () => {
        const store = await loadedStore({root: deployed()})
        await store.dispatch('populateDeploymentResources', {deployment: store.getters.getDeployment, environmentName: 'prod'})
        const g = store.getters
        expect(g.getDeploymentTemplate).toMatchObject({name: 'dep1', primary: 'app_r', __typename: 'Deployment'})
        expect(g.primaryCardProperties).toEqual([{name: 'title', value: 'Blog'}])
        expect(g.getCardsStacked.map(c => c.name)).toEqual(['db_r'])
        expect(g.getCardType('db_r')).toBe('DB')
        expect(g.getDependencies('app_r')).toMatchObject([{name: 'db', target: 'db_r'}])
    })

    it('refuses a deployment whose template it cannot find', async () => {
        const store = await loadedStore({root: deployed()})
        await expect(store.dispatch('populateDeploymentResources', {deployment: {__typename: 'Deployment', deploymentTemplate: 'nope'}}))
            .rejects.toMatchObject({message: "Could not lookup deployment blueprint 'nope'", flash: true})
    })
})

describe('reading the dependency graph', () => {
    it('lists displayable dependencies, surfacing ones buried under a hidden card', async () => {
        const root = exportRoot()
        root.ResourceTemplate.the_db.visibility = 'hidden'
        root.ResourceTemplate.the_db.dependencies = [{name: 'disk', match: null, constraint: {name: 'disk', resourceType: 'Disk', min: 0, max: 1, visibility: 'visible'}}]
        const store = await loadedStore({root})
        const shown = store.getters.getDisplayableDependenciesByCard('the_app')
        expect(shown.map(({card, dependency, buried}) => [card.name, dependency.name, !!buried])).toEqual([
            // the db constraint is hidden with the template it matches
            ['the_db', 'disk', true], ['the_app', 'cache', false],
        ])
    })

    it('finds the titles under a match: shown ones, and through the rest', async () => {
        const store = await loadedStore()
        expect(store.getters.resolveRequirementMatchChildren('the_app')).toEqual([])
        store.commit('createReference', {dependentName: 'the_app', dependentRequirement: 'db', resourceTemplate: {name: 'the_db'}, fieldsToReplace: {completionStatus: 'created'}})
        expect(store.getters.resolveRequirementMatchChildren('the_app')).toEqual(['the_db'])
    })

    it('reads children of mutually dependent templates', async () => {
        const store = await loadedStore()
        store.state.templates.resourceTemplates.the_db.dependencies = [{name: 'x', match: 'the_app', constraint: {name: 'x', visibility: 'visible'}}]
        expect(store.getters.resolveRequirementMatchChildren('the_db')).toEqual([])
    })

    it('reads a template\'s dependent', async () => {
        const store = await loadedStore()
        store.commit('createReference', {dependentName: 'the_db', dependentRequirement: 'x', resourceTemplate: {name: 'the_app'}})
        expect(store.getters.getDependent('the_db')).toMatchObject({name: 'the_app'})
        expect(store.getters.getParentDependency('the_db')).toMatchObject({name: 'the_db'})
        expect(store.getters.getDependent('the_app')).toBeNull()
    })

    it('offers templates of the right type with room left as connections', async () => {
        const store = await loadedStore()
        const db = store.getters.getDependencies('the_app')[0]
        expect(store.getters.getValidConnections('the_app', {...db, _utilization: 0}).map(t => t.name)).toEqual(['the_db'])
        // the db requirement already uses the_db's one slot
        expect(store.getters.getCardUtilization('the_db')).toBe(1)
        expect(store.getters.getValidConnections('the_app', {...db, _utilization: 1})).toEqual([])
        expect(store.getters.getValidConnections('missing', db)).toBeNull()
    })
})
