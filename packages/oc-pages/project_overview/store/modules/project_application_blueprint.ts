import {uniq} from 'lodash'
import {unfurlServerExport} from 'oc_vue_shared/client_utils/unfurl-server'
import {fetchLastCommit} from 'oc_vue_shared/client_utils/projects'
import {localNormalize} from 'oc_vue_shared/lib/normalize'
import {applyInputsSchema, applyRequirementsFilter} from 'oc_vue_shared/lib/node-filter'
import { repoToExportParams, fetchTypeRepositories, unfurlServerGetTypes } from  'oc_vue_shared/client_utils/unfurl-server'
import { deepClone as cloneDeep } from 'oc_vue_shared/util'
import _ from 'lodash'
import {freeze} from 'oc_vue_shared/client_utils/misc'
import type {ActionContext, Module} from '@gitlab/vuex-vue3'
import type {LastCommitResult} from 'oc_vue_shared/client_utils/projects'

// The unfurl export JSON; typed loosely until the payload types exist.
type Json = Record<string, any>

// [the template that depends on this one, the requirement it fills]
type Ancestor = [Json, string]

// The blueprint export, held under its own keys (ResourceType,
// ResourceTemplate, DeploymentTemplate, ...) beside the fixed fields.
interface State {
    loaded: boolean
    callbacks: (() => void)[]
    clean: boolean
    [exportKey: string]: any
}

type Context = ActionContext<State, any>

interface NormalizationCache {
    resourceTypes: Map<string, Json | null>
    missingDependencies: Map<string, Json[]>
    missingProperties: Map<string, Json[]>
    groupProperties: Map<string, {properties: Json[], computedProperties: Json[]}>
}

function computeDependencyMap(root: Json): Record<string, Ancestor> | undefined {
    try {
        const res = (Object.values(root.ResourceTemplate || {}) as Json[])
            .map(
                rt => rt.dependencies
                .filter((req: Json) => req.match)
                .map((req: Json) => ({[req.match]: [rt, req.name]}))
            ).flat()

        return Object.assign({}, ...res)
    } catch(e) {console.error(e)}
}

// Memoised per application root. This cache used to be stashed on `root`
// itself, which is store state: Vue 2 ignored a newly added property, so
// vuex's strict-mode watcher never saw the write, while Vue 3's proxy traps
// it and strict mode throws -- aborting createNodeResource mid-way and
// leaving the resource uncreated. Keyed weakly so the lifetime is unchanged.
const dependencyMapCache = new WeakMap<object, Record<string, Ancestor>>()

function lookupAncestors(rt: Json, root: Json, mutable=false): Ancestor[] {
    let computedDependencyMap = (mutable && root)? dependencyMapCache.get(root): null
    if(!computedDependencyMap) {
        computedDependencyMap = computeDependencyMap(root)
        if(mutable && root && computedDependencyMap)  {
            dependencyMapCache.set(root, computedDependencyMap)
        }
    }

    // fail silently in the case that we wanted to normalize a resource or template, but didn't have enough context
    if(!computedDependencyMap) {
        return []
    }

    let current = rt, matchEntry: Ancestor | undefined
    const reverseAncestors: Ancestor[] = []
    const visited = new Set([current.name])
    while(matchEntry = computedDependencyMap[current.name]) {
        const [next] = matchEntry
        // Stop before pushing an edge that loops back to a node we've already
        // seen. Without this the resulting _ancestors chain can contain a
        // cycle (A → B → A), which later causes Array.push to throw
        // "Invalid array length" or makes downstream consumers (e.g.
        // getNestedTemplates) recurse forever.
        if(visited.has(next.name)) {
            console.warn(`lookupAncestors: cycle detected: ${current.name} -> ${next.name}`)
            break
        }
        visited.add(next.name)
        reverseAncestors.push(matchEntry)
        current = next
    }

    return reverseAncestors.reverse()
}

const state = (): State => ({loaded: false, callbacks: [], clean: true})
const mutations = {
    setProjectState(state: State, {key, value}: {key: string, value: unknown}) {
        if (!state[key] || typeof value !== 'object') {
            state[key] = value
        } else {
            state[key] = {...state[key], ...(value as object)}
        }
        state.clean = false
    },

    setProjectStateBatch(state: State, updates: {key: string, value: unknown}[]) {
        updates.forEach(({key, value}) => {
            if (!state[key] || typeof value !== 'object') {
                state[key] = value
            } else {
                state[key] = {...state[key], ...(value as object)}
            }
        })
        state.clean = false
    },

    resetProjectState(state: State) {
        for(const key in state) {
            let value: unknown = null
            switch(key) {
                case 'loaded':
                    value = false; break
                case 'callbacks':
                    value = []; break
                case 'clean':
                    value = true; break
            }
            state[key] = value
        }
    },

    loaded(state: State, status: boolean) {
        state.loaded = status
        state.callbacks.forEach(cb => {if(typeof cb == 'function') {cb()} else throw new Error('application blueprint callback is not a function')})

        state.callbacks = []
    },
    onApplicationBlueprintLoaded(state: State, cb: () => void) { if(state.loaded) {cb()} else state.callbacks.push(cb) },

    // template_resources' createNodeResource, for a type from an incomplete repository
    addTempRepository(state: State, repo: {url: string, [key: string]: unknown}) {
        state.repositories[repo.url] = {...repo, temp: true}
    }

}
const actions = {
    async fetchProject({state, commit, dispatch, rootGetters}: Context, params: {
        projectPath: string
        blueprintPath?: string
        projectGlobal?: unknown
        shouldMerge?: boolean
        branch?: string
        forEditing?: boolean
    }) {
        let {projectPath, blueprintPath, projectGlobal, shouldMerge, branch, forEditing} = {shouldMerge: false, ...params}
        const format = 'blueprint'

        // params.branch is only ever a route pin (?bprev=, see templates/index.vue);
        // the deployment.packages version fill-in below is not one, so it may
        // still let the export response record current_branch
        const setCurrentBranch = !branch

        const deployment = Object.values(state.Deployment || {})[0] as Json | undefined

        if(deployment && !branch) {
            try {
                branch = deployment.packages[projectPath].version
            } catch(e) {}
        }

        // When editing, resolve the branch HEAD so the export request runs against
        // a known-fresh commit. On a reload (state.loaded) we can short-circuit
        // entirely if the HEAD hasn't moved and there's no in-flight queue work —
        // the store is still current. First load has to populate the store
        // regardless, so we only forward the resolved tuple in that case.
        let lastCommitResult: LastCommitResult | undefined
        if (forEditing) {
            try {
                // if branch == "(MISSING)" (set by deployment.packages above, intended for unfurlServerExport() below)) use default branch instead
                const editBranch = branch == "(MISSING)" ? "" : branch!;
                lastCommitResult = await fetchLastCommit(projectPath, editBranch)
                if (state.loaded) {
                    const [, , queueid, changed] = lastCommitResult
                    if (!queueid && !changed) {
                        return
                    }
                }
            } catch(e) {
                console.warn('@fetchProject: skipping freshness check after fetchLastCommit error', e)
                lastCommitResult = undefined
            }
        }

        commit('loaded', false)

        let root: Json
        try {
            root = (await unfurlServerExport({
                format,
                projectPath,
                deploymentPath: blueprintPath,
                sendCredentials: !(rootGetters.getGlobalVars?.projectPath == projectPath && rootGetters.getGlobalVars?.projectVisibility == 'public'),
                branch,
                setCurrentBranch,
                lastCommitResult,
            }))!
        } catch(_e) {
            // TODO handle this from the caller
            const e = _e as Error & {response?: {data?: unknown}}
            const responseData = e.response?.data
            commit(
                'createError',
                {
                    message: `An error occurred while exporting ${projectPath}`,
                    context: {
                        error: e.message,
                        projectPath,
                        format,
                        ...(typeof responseData == 'object'? responseData: null)
                    },
                    severity: 'critical',
                }
            )

            return
        }


        root.projectGlobal = projectGlobal

        if(root.ResourceType) {
            Object.values(root.ResourceType).forEach(resourceType => {
                localNormalize(resourceType, 'ResourceType', root)
            })
        }

        await dispatch('useProjectState', {projectPath, root, shouldMerge})
        commit('loaded', true)


    },

    normalizeUnfurlData({getters, commit}: Context, {key, entry, root, projectPath, cache}: {
        key: string
        entry: Json
        root: Json
        projectPath?: string
        cache?: NormalizationCache
    }) {
        let transforms: Record<string, (entry: Json, root: Json) => void>

        // Initialize cache if not provided
        if (!cache) {
            cache = {
                resourceTypes: new Map(),
                missingDependencies: new Map(),
                missingProperties: new Map(),
                groupProperties: new Map()
            }
        }

        function normalizeProperties(properties: unknown): Json[] {
            if(!properties || typeof properties != 'object') {
                return []
            } else if (Array.isArray(properties)) {
                return properties
            } else {
                console.warn('@normalizeProperties: Converting properties into an array', properties)
                return Object.entries(properties)
                    .reduce((acc: Json[], [name, value])  => {acc.push({name, value}); return acc}, [])
            }
        }

        function normalizeDependencies(dependencies: unknown): Json[] {
            if(!dependencies || typeof dependencies != 'object') {
                return []
            } else if (Array.isArray(dependencies)) {
                return dependencies
            } else {
                console.warn('@normalizeDependencies: Converting dependencies into an array', dependencies)
                return Object.entries(dependencies)
                    .reduce((acc: Json[], [name, value])  => {acc.push({name, value}); return acc}, [])
            }
        }

        const _cache = cache

        // Cached getter wrapper
        function getCachedResourceType(typeName: string) {
            if (!_cache.resourceTypes.has(typeName)) {
                _cache.resourceTypes.set(typeName, getters.resolveResourceType(typeName))
            }
            return _cache.resourceTypes.get(typeName)
        }

        function getCachedMissingDependencies(resourceTemplate: Json): Json[] {
            const key = resourceTemplate.name || JSON.stringify(resourceTemplate)
            if (!_cache.missingDependencies.has(key)) {
                _cache.missingDependencies.set(key, getters.getMissingDependencies(resourceTemplate))
            }
            return _cache.missingDependencies.get(key)!
        }

        function getCachedMissingProperties(resourceTemplate: Json): Json[] {
            const key = resourceTemplate.name || JSON.stringify(resourceTemplate)
            if (!_cache.missingProperties.has(key)) {
                _cache.missingProperties.set(key, getters.getMissingProperties(resourceTemplate))
            }
            return _cache.missingProperties.get(key)!
        }

        function getCachedGroupProperties(resourceTemplate: Json) {
            const key = resourceTemplate.name || JSON.stringify(resourceTemplate)
            if (!_cache.groupProperties.has(key)) {
                _cache.groupProperties.set(key, getters.groupProperties(resourceTemplate))
            }
            return _cache.groupProperties.get(key)!
        }

        // TODO refactor independent transformations into vue_shared/lib/normalize
        transforms = {
            ResourceType(resourceType) {
                localNormalize(resourceType, 'ResourceType', root)
            },
            ResourceTemplate(resourceTemplate) {
                resourceTemplate.dependencies = _.uniqBy(normalizeDependencies(resourceTemplate.dependencies), 'name')
                resourceTemplate.properties = _.uniqBy(normalizeProperties(resourceTemplate.properties), 'name')
                resourceTemplate._ancestors = lookupAncestors(resourceTemplate, root, true)

                resourceTemplate.properties.forEach((prop: Json) => {
                    if(Array.isArray(prop.value?.get_env)) {
                        prop.value.get_env = prop.value.get_env[0]
                    }
                })

                const {properties, computedProperties} = getCachedGroupProperties(resourceTemplate)
                resourceTemplate.properties = properties
                resourceTemplate.computedProperties = computedProperties

                for(const generatedDep of getCachedMissingDependencies(resourceTemplate)) {
                    resourceTemplate.dependencies.push(generatedDep)
                }
                for(const generatedProp of getCachedMissingProperties(resourceTemplate)) {
                    resourceTemplate.properties.push(generatedProp)
                }

                for(const prop of resourceTemplate.properties) {
                    if(prop.value == '<<REDACTED>>') prop.value = null
                    if(prop.value?.secret) {
                        prop.value.get_env = prop.value.secret
                    }
                }

                // aggressively add _sourceinfo if immediately available
                // this will not always be able to get _sourceinfo from types calls
                if(!resourceTemplate._sourceinfo) {
                    const type = getCachedResourceType(resourceTemplate.type)
                    if(type?._sourceinfo) {
                        resourceTemplate._sourceinfo = type._sourceinfo
                    }
                }

                localNormalize(resourceTemplate, 'ResourceTemplate', root)
            },
            DeploymentTemplate(deploymentTemplate, root) {
                if(!deploymentTemplate.resourceTemplates) {
                    deploymentTemplate.resourceTemplates = []
                }
                if(deploymentTemplate.ResourceTemplate) {
                    Object.values(deploymentTemplate.ResourceTemplate as Record<string, Json>).forEach(rt => transforms.ResourceTemplate(rt, root))
                }
                if(projectPath && !deploymentTemplate.projectPath) {
                    deploymentTemplate.projectPath = projectPath
                }
                if(deploymentTemplate._sourceTemplate) {
                    if(!deploymentTemplate.ResourceTemplate) {
                        deploymentTemplate.ResourceTemplate = {}
                    }

                    Object.entries(getters.resolveDeploymentTemplate(deploymentTemplate._sourceTemplate)?.ResourceTemplate || {} as Json).forEach(([name, rt]) => {
                        if(
                            (root.ResourceTemplate[name] && root.ResourceTemplate[name].directives.includes('default')) &&
                            (!deploymentTemplate.ResourceTemplate[name])
                        ) {
                            deploymentTemplate.ResourceTemplate[name] = rt
                        }
                    })
                }
                deploymentTemplate.__typename = 'DeploymentTemplate'
                localNormalize(deploymentTemplate, 'DeploymentTemplate', root)
            },
            ApplicationBlueprint(applicationBlueprint) {
                if(!applicationBlueprint.title) {
                    applicationBlueprint.title = applicationBlueprint.name
                }
                if(projectPath && !applicationBlueprint.projectPath) {
                    applicationBlueprint.projectPath = projectPath
                }
                applicationBlueprint.__typename = 'ApplicationBlueprint'
            },
            Resource(resource, root) {
                if(!resource.dependencies) resource.dependencies = resource.connections || []
                if(!resource.attributes) resource.attributes = []
                if(!resource.visibility) resource.visibility = 'inherit'

                resource._ancestors = lookupAncestors(resource, root, true)

                resource.dependencies.forEach((dep: Json) => {
                    const visibility = dep.visibility || dep.constraint.visibility || 'visible'
                    dep.constraint.visibility = dep.visibility = visibility
                })

                for(const attribute of resource.attributes) {
                    if(attribute.value?.secret) {
                        attribute.value.get_env = attribute.value.secret
                    }
                }

                resource.__typename = 'Resource'

                // infer types from template when they're not available
                if(!resource.type && resource.template) {
                    try {
                        resource.type = root['ResourceTemplate'][resource.template].type
                    } catch(e) {}
                }
            },
            Deployment(deployment) {
                const dt = getters.resolveDeploymentTemplate(deployment.deploymentTemplate)
                deployment.projectPath = dt?.projectPath
            },
            DeploymentEnvironment(de, root) {
                for(const connection of Object.values(de.connections || {}) as Json[]) {
                    if(!root.ResourceTemplate) { root.ResourceTemplate = {} }

                    // intentionally not cloning
                    // we want to normalize this record in both places
                    root.ResourceTemplate[connection.name] = connection
                }
            },
            repositories(entry) {
                const url = new URL(entry.url)
                const origin = url.origin

                if(window.location.origin == origin) {
                    commit('addRepositoryDependencies', [url.pathname.slice(1).replace(/\.git$/, '')], {root: true})
                }
            }
        }


        if(Object.isFrozen(entry)) return
        transforms[key] && transforms[key](entry, root)
    },

    async useProjectState({state, commit, dispatch}: Context, {projectPath, root, shouldMerge}: {projectPath?: string, root: Json, shouldMerge?: boolean}) {
        console?.assert(root && typeof root == 'object', 'Cannot use project state', root)
        if(!(state.clean || shouldMerge)) {
            commit('resetProjectState')
            commit('clearRepositoryDependencies', null, {root: true})
        }

        if(state.clean && projectPath) {
            commit('addRepositoryDependencies', [projectPath], {root: true})
        }

        const requiredSubstituteTypes: Json[] = (Object.values(root.ResourceTemplate || {}) as Json[]).filter(rt => rt.directives?.includes('substitute')).map(rt => root.ResourceType[rt.type])

        const cloud = Object.values(root.DeploymentTemplate || {}).length == 1 && (Object.values(root.DeploymentTemplate)[0] as Json).cloud

        if(cloud) {
            await Promise.all(requiredSubstituteTypes.map(async (st) => {
                const exportParams = {...repoToExportParams(st._sourceinfo), file: st._sourceinfo?.file}

                const implementation_requirements = [cloud]
                const _extends = [st.name]
                const implementations = ['create']

                // the server takes more params than this module's signature names
                const params = {implementations, implementation_requirements, 'extends': _extends} as Parameters<typeof unfurlServerGetTypes>[1]
                const fetchedTypes = (await unfurlServerGetTypes(exportParams as Parameters<typeof unfurlServerGetTypes>[0], params))!.ResourceType

                ;(Object.values(fetchedTypes) as Json[]).filter(t => t.directives?.includes('substitute')).forEach(t => {root.ResourceType[t.name] = t})
            }))
        }

        // guarunteed ordering
        const ordering = uniq(['ResourceType', 'DefaultTemplate', 'DeploymentEnvironment', 'ResourceTemplate', 'DeploymentTemplate', 'Deployment'].concat(Object.keys(root)))

        // Batch size for processing entries to reduce memory pressure
        const BATCH_SIZE = 50

        // Create a shared cache for all normalization operations
        const normalizationCache = {
            resourceTypes: new Map(),
            missingDependencies: new Map(),
            missingProperties: new Map(),
            groupProperties: new Map()
        }

        for(const key of ordering) {
            const value = root[key]

            if(! value) continue

            const entries = Object.values(value)

            // Process entries in batches to allow garbage collection between batches
            for(let i = 0; i < entries.length; i += BATCH_SIZE) {
                const batch = entries.slice(i, i + BATCH_SIZE)

                batch.forEach(entry => {
                    try {
                        dispatch('normalizeUnfurlData', {key, entry, root, projectPath, cache: normalizationCache})
                    } catch(e) {
                        // Sanitize error logging to prevent memory retention of large objects
                        console.error('@useProjectState normalization error', {
                            key,
                            entryName: (entry as Json)?.name || (entry as Json)?.title || 'unknown',
                            projectPath,
                            errorMessage: (e as Error).message,
                            errorStack: (e as Error).stack
                        })
                        console.error(e)
                    }
                })

                // Allow garbage collection between batches
                if (i + BATCH_SIZE < entries.length) {
                    await new Promise(resolve => setTimeout(resolve, 0))
                }
            }

            // commit so we can use our resolvers while normalizing
            if(key == 'ResourceType') {
                commit('setProjectState', {key, value})
            }
        }
        if(root.ApplicationBlueprint) {
            commit('setProjectState', {key: 'applicationBlueprint', value: Object.values(root.ApplicationBlueprint)[0]})
        }

        // Batch commit remaining state updates to reduce mutation overhead
        const batchUpdates: {key: string, value: unknown}[] = []
        for(const key of ordering) {
            if(key == 'ResourceType') continue
            const value = root[key]
            if (value) {
                batchUpdates.push({key, value})
            }
        }
        if (batchUpdates.length > 0) {
            commit('setProjectStateBatch', batchUpdates)
        }
    },

    async blueprintFetchTypesWithParams({state, getters, commit, dispatch}: Context, {params}: {params: Parameters<typeof fetchTypeRepositories>[1]}) {
        let types: Record<string, Json>
        let nestedTemplatesByPrimary = {}
        try {
            const typesRepositoryResults = (await fetchTypeRepositories(getters.blueprintRepositories, params))
            types = typesRepositoryResults.types as Record<string, Json>
            nestedTemplatesByPrimary = typesRepositoryResults.nestedTemplatesByPrimary
        } catch(e) {
            const context = {
                repositories: getters.blueprintRepositories,
                params
            }

            try { Object.assign(context, e) }
            catch(e) {console.error(e)}

            commit('createError', {
                message: `Load blueprint types: failed to fetch types (${(e as Error).message})`,
                context,
                severity: 'major'
            }, {root: true})

            return
        }

        // prioritize types that are already defined when new type is incomplete
        Object.entries(state.ResourceType as Record<string, Json>).forEach(([name, currentType]) => {
            const newType = types[name]

            if(newType && !newType._sourceinfo?.incomplete) {
                if(currentType.icon) {
                    newType.icon = currentType.icon
                }

                return
            }

            types[name] = currentType
        })

        await dispatch(
            'useProjectState',
            {root: {ResourceType: types}, shouldMerge: true}
        )


        commit('setProjectState', {key: "nestedTemplatesByPrimary", value: {...state.nestedTemplatesByPrimary, ...nestedTemplatesByPrimary}})
    }
}

// A getter resolving one export key by name; given a function instead, that
// function does the lookup.
function storeResolver(typename: string | ((state: State, ...args: any[]) => Json | null | undefined)) {
    return function(state: State) {
        const dictionary = typeof typename == 'string'? state[typename]: state
        if(!dictionary) return () => null
        return function(...args: any[]): Json | null {
            let name = args[0]
            let entry
            if(typeof typename == 'function') {
                entry = typename(state, ...args)
            } else {
                entry = dictionary[name]
            }
            if(entry) {
                let result: Json | undefined
                if (typename === 'DeploymentTemplate') {
                    // TODO maybe there is another way to do this
                    // NOTE entry might be frozen, so here I assign the new field first
                    result = {
                        ...result,
                        _primary: state['ResourceTemplate'][entry.primary]
                    }
                    result = Object.assign(result, entry)
                } else if (typename === 'ResourceTemplate') {
                    // TODO maybe there is another way to do this
                    // NOTE entry might be frozen, so here I assign the new field first
                    // NOTE looks the type name up among templates, so _type is
                    // almost always undefined; deployment_template_updates.js
                    // reads it defensively. Left as is: correcting it changes what that sees.
                    result = {
                        ...result,
                        _type: state['ResourceTemplate'][entry.type]
                    }
                    result = Object.assign(result, entry)
                }
                else result = entry
                return freeze(result!)
            } else {
                if(typename == 'ResourceType') {
                    const qualifiedPrefix = `${name}@`
                    for(const key in dictionary) {
                        if(key.startsWith(qualifiedPrefix)) {
                            return dictionary[key]
                        }
                    }
                }
                return null
            }
        }
    }
}

// what the getters below read from each other
type BlueprintGetters = Record<string, any>

const getters = {
    getApplicationRoot(state: State) {return state},
    resolveResourceType: storeResolver('ResourceType'),
    resolveResourceTypeWithAncestors(state: State, getters: BlueprintGetters) {
        // Cache for already-resolved type + ancestor combinations
        const resolvedCache = new Map<string, Json>()

        // where ancestors looks like [(ResourceType, RequirementConstraint?)]
        return function(resourceType: string, ancestors: Ancestor[]) {
            console.assert(!!resourceType, 'expected resource type')
            if(ancestors.length == 0)  {
                return getters.resolveResourceType(resourceType)
            }

            // Create a cache key from resourceType and ancestors
            const cacheKey = `${resourceType}::${ancestors.map(([rt, req]) => `${rt.type}:${req}`).join('|')}`
            if (resolvedCache.has(cacheKey)) {
                return resolvedCache.get(cacheKey)
            }

            // Only deep clone the final child type that will be mutated
            const childType = cloneDeep(getters.resolveResourceType(resourceType))

            // Build path without cloning intermediate types (they won't be mutated)
            const nodeFilterPath: [Json, string | null][] = [
                ...(ancestors.map(([rt, req]): [Json, string] => [getters.resolveResourceType(rt.type), req])),
                [childType, null]
            ]

            for(let i = 0; i < ancestors.length; i++) {
                try {
                    const [current, req] = nodeFilterPath[i]
                    const [child, _] = nodeFilterPath[i+1]

                    const requirement = current.requirements.find((r: Json) => r.name == req)

                    if(requirement?.requirementsFilter) {
                        applyRequirementsFilter(child, requirement.requirementsFilter)
                    }

                    if(requirement?.inputsSchema) {
                        applyInputsSchema(child, requirement.inputsSchema)
                    }
                } catch(e) {
                    // Sanitize error logging to avoid retaining large cloned objects
                    console.error('Could not apply requirements filter to requirement', {
                        index: i,
                        ancestorCount: ancestors.length,
                        resourceTypeName: resourceType,
                        errorMessage: (e as Error).message,
                        errorStack: (e as Error).stack
                    })
                    console.error(e)
                }
            }

            const result = _.last(nodeFilterPath)![0]
            resolvedCache.set(cacheKey, result)
            return result
        }
    },
    resolveResourceTemplateType(state: State, getters: BlueprintGetters) {
        return function(resourceTemplate: string | Json) {
            const rt = typeof resourceTemplate == 'string'? getters.resolveResourceTemplate(resourceTemplate): resourceTemplate
            return getters.resolveResourceType(rt.type)

            // too slow at the moment for the fact that it's not that useful
            // this is just for normalization

            // const ancestors = rt._ancestors || lookupAncestors(rt, state)
            // return getters.resolveResourceTypeWithAncestors(rt.type, ancestors)
        }
    },
    resolveResourceTemplate: storeResolver('ResourceTemplate'),
    resolveDeploymentTemplate: storeResolver('DeploymentTemplate'),
    resolveLocalResourceTemplate: storeResolver(
        function(state: State, deploymentTemplate: string, name: string) {
            try {
                return state.DeploymentTemplate[deploymentTemplate].ResourceTemplate[name]
            } catch(e) {return null}
        }
    ),
    localResourceTemplates(state: State) {
        return (deploymentTemplate: string): Json[] => {
            try {
                return Object.values(state.DeploymentTemplate[deploymentTemplate].ResourceTemplate)
            } catch(e) {
                return []
            }
        }
    },
    topLevelTemplates(state: State): Json[] {
        return Object.values(state.ResourceTemplate)
    },
    resolveResource(state: State) {
        return (name: string | null | undefined): Json | null | undefined => {
            if(!name) return null
            try {
                let rt = state['Resource'][name]
                if(!rt && !name?.startsWith('::')) {
                    rt = state['Resource'][`::${name}`]
                }
                return rt
            } catch(e) {
                return null
            }
        }
    },
    resolveDeployment(state: State) { return (name: string) =>  state['Deployment']?.[name] },
    dependenciesFromResourceType(_: State, getters: BlueprintGetters) {
        return function(resourceTypeName: string | Json | null | undefined) {
            let resourceType
            if(typeof resourceTypeName == 'string') {
                resourceType = getters.resolveResourceType(resourceTypeName)
            } else { resourceType = resourceTypeName }

            if(!resourceType?.requirements) return []
            return resourceType.requirements.map((req: Json) => ({
                name: req.name,
                constraint: req,
                match: null,
                target: null,
                __typename: 'Dependency'
            }))
        }
    },
    // TODO use names instead of titles
    propertiesFromResourceType(_: State, getters: BlueprintGetters) {
        return function(resourceTypeName: string | Json | null | undefined) {
            let resourceType
            if(typeof resourceTypeName == 'string') {
                resourceType = getters.resolveResourceType(resourceTypeName)
            } else { resourceType = resourceTypeName }

            if(!resourceType?.inputsSchema?.properties) return []
            const result = Object.keys(resourceType.inputsSchema.properties).map(key => ({
                name: key,
                value: null
            }))
            return result
        }
    },
    getMissingDependencies(_: State, getters: BlueprintGetters) {
        return function(resourceTemplate: Json): Json[] {
            const generatedDependencies = getters.dependenciesFromResourceType(getters.resolveResourceTemplateType(resourceTemplate))
            if(generatedDependencies.length == resourceTemplate.dependencies?.length) {
                return [] // assuming they're correct
            }
            if(!resourceTemplate.dependencies?.length) {
                return generatedDependencies
            }
            const result: Json[] = []
            for(const generated of generatedDependencies) {
                if(!resourceTemplate.dependencies.some((dep: Json) => dep.name == generated.name)) {
                    result.push(generated)
                }
            }
            return result
        }
    },
    getMissingProperties(_: State, getters: BlueprintGetters) {
        return function(resourceTemplate: Json): Json[] {
            const generatedProperties = getters.propertiesFromResourceType(getters.resolveResourceTemplateType(resourceTemplate))
            if(generatedProperties.length == resourceTemplate.properties?.length) {
                return [] // assuming they're correct
            }
            if(!resourceTemplate.properties?.length) {
                return generatedProperties
            }
            const result: Json[] = []
            for(const generated of generatedProperties) {
                if(!resourceTemplate.properties.some((prop: Json) => prop.name == generated.name)) {
                    result.push(generated)
                }
            }
            return result
        }
    },
    groupProperties(_: State, getters: BlueprintGetters) {
        return function(resourceTemplate: Json) {
            const type = getters.resolveResourceTemplateType(resourceTemplate)
            const groups: {properties: Json[], computedProperties: Json[]} = {properties: [], computedProperties: []}

            for(const property of resourceTemplate.properties || []) {
                if(type?.computedPropertiesSchema?.properties?.hasOwnProperty(property.name)) {
                    groups.computedProperties.push(property)
                } else {
                    // preserve arbitrary properties
                    groups.properties.push(property)
                }
            }
            return groups
        }
    },
    getApplicationBlueprint(state: State) { return state.applicationBlueprint },

    getPrimaryDeploymentBlueprint(state: State, getters: BlueprintGetters) {
        return getters.getApplicationBlueprint?.primaryDeploymentBlueprint || (Object.values(state.DeploymentTemplate || {})[0] as Json | undefined)?.name
    },

    getResources(state: State): Json[] {return Object.values(state.Resource || {})},
    getDeployment(state: State): Json | undefined {return Object.values(state.Deployment || {})[0] as Json | undefined},

    applicationBlueprintIsLoaded(state: State) {return state.loaded},

    getTemplatesList(state: State): Json[] {
        return (Object.values(state.DeploymentTemplate) as Json[])
            ?.filter(dt => dt && dt.visibility != 'hidden')
    },

    requirementsForType(_: State, getters: BlueprintGetters) {
        return function(_rt: string | Json) {
            const rt = getters.resolveResourceType((_rt as Json)?.name || _rt)
            return rt.requirements
        }
    },

    inputsSchemaForType(_: State, getters: BlueprintGetters) {
        return function(_rt: string | Json) {
            const rt = getters.resolveResourceType((_rt as Json)?.name || _rt)
            return rt.inputsSchema
        }
    },

    outputsSchemaForType(_: State, getters: BlueprintGetters) {
        return function(_rt: string | Json) {
            const rt = getters.resolveResourceType((_rt as Json)?.name || _rt)
            return rt.outputsSchema
        }
    },

    blueprintResourceTypeDict(state: State) {
        return state.ResourceType
    },

    blueprintRepositories(state: State): Json[] {
        return Object.values(state.repositories || {})
    },

    nestedTemplatesByPrimary(state: State) {
        return state.nestedTemplatesByPrimary || {}
    }
}


export default {state, mutations, actions, getters} satisfies Module<State, any>
