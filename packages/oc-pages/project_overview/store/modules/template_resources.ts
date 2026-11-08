import _ from 'lodash'
import type {ActionContext, Module} from '@gitlab/vuex-vue3'
import { lookupCloudProviderAlias, slugify, generateCardId, deepClone as cloneDeep } from 'oc_vue_shared/util';
import {shouldConnectWithoutCopy} from 'oc_vue_shared/storage-keys';
import type {Accumulator} from './deployment_template_updates';
import {appendDeploymentTemplateInBlueprint, appendResourceTemplateInDependent, createResourceTemplate, createEnvironmentInstance, deleteResourceTemplate, deleteResourceTemplateInDependent, deleteEnvironmentInstance, updatePropertyInInstance, updatePropertyInResourceTemplate, createResourceTemplateInDeploymentTemplate} from './deployment_template_updates';
import {constraintTypeFromRequirement} from 'oc_vue_shared/lib/resource-template'
import { importsAreEqual } from  'oc_vue_shared/client_utils/unfurl-server'
import type {Repository} from 'oc_vue_shared/client_utils/unfurl-server'
import {applyInputsSchema, customMerge} from 'oc_vue_shared/lib/node-filter'
import {isConfigurable} from 'oc_vue_shared/client_utils/resource_types'

// The unfurl export JSON; typed loosely until the payload types exist.
type Json = Record<string, any>
// a card, or its name
type Named = Json | string | null | undefined
type Getters = Record<string, any>
// what createNodeResource builds and hands to the create helpers
type Card = Json & {name: string, type: any}
const nameOf = (x: Named) => (x as Json)?.name || (x as string)

interface LastFetchedFrom {
    projectPath?: string
    templateSlug?: string
    environmentName?: string
    noPrimary: boolean
    sourceDeploymentTemplate?: string
}

interface State {
    deploymentTemplate: Json
    resourceTemplates: Record<string, Json>
    // card name => input path => status
    inputValidationStatus: Record<string, Record<string, string>>
    availableResourceTypes: Json[]
    tempRepositories: Json[]
    // set by populate*, before anything reads it
    lastFetchedFrom: LastFetchedFrom
    context?: string
}

type Context = ActionContext<State, any>

function dateSuffix() {
    return Date.now().toString(36)
}

// Shared eligibility test used by both getCardsStacked and
// getHiddenCardsStacked. A card belongs in the stacked view when:
//  - for a Deployment, it isn't the primary; or
//  - for a blueprint, it's referenced by a parent's match/target requirement.
function isStackedCard(rt: Json, state: State, getters: Getters) {
    if(state.deploymentTemplate.__typename == 'Deployment') {
        return !state.deploymentTemplate?.primary || rt.name != state.deploymentTemplate.primary
    }
    const parentDependencies = getters.getDependenciesMatchingCard(rt.name)
    if(parentDependencies.length == 0) return false
    return rt.__typename == 'ResourceTemplate'
        ? parentDependencies.some((dep: Json) => dep.match == rt.name)
        : parentDependencies.some((dep: Json) => dep.target == rt.name)
}

// The titles a requirement's match leads to: a shown dependency's own, and through
// any other to what it matches. Matches can point back up the graph.
function walkMatchChildren(state: State, requirement: Named, seen: Set<string>): string[] {
    const match: string = typeof requirement == 'string'? requirement:
        state.context == 'deployment' ? requirement?.target : requirement?.match
    if(seen.has(match)) return []
    seen.add(match)
    const resourceTemplate = state.resourceTemplates[match]
    let children: string[] = []
    for (const dep of resourceTemplate?.dependencies || []) {
        if (dep.constraint.visibility === 'visible' && dep?.completionStatus) {
            children.push(state.resourceTemplates[dep.match]?.title)
        } else if (dep.match) {
            children = children.concat(walkMatchChildren(state, dep.match, seen))
        }
    }
    return children
}

const baseState = (): Omit<State, 'lastFetchedFrom' | 'context'> => ({
    deploymentTemplate: {},
    resourceTemplates: {},
    inputValidationStatus: {},
    availableResourceTypes: [],
    tempRepositories: [],
});

const timeouts: Record<string, ReturnType<typeof setTimeout>> = {}

const state = baseState() as State;

const mutations = {
    resetTemplateResourceState(state: State) {
        for(const [key, value] of Object.entries(baseState())){
            (state as Json)[key] = value
        }
    },

    // TODO account for duplicate or enumerated properties
    setInputValidStatus(state: State, {card, path, status}: Json) {
        const cardName = nameOf(card)
        if(!state.inputValidationStatus[cardName]) {
            state.inputValidationStatus[cardName] = {[path]: status}
        }
        else {
            state.inputValidationStatus[nameOf(card)][path] = status
        }
    },

    setAvailableResourceTypes(state: State, resourceTypes: Json[]) {
        state.availableResourceTypes = resourceTypes
    },

    setDeploymentTemplate(_state: State, deploymentTemplate: Json) {
        // eslint-disable-next-line no-param-reassign
        _state.deploymentTemplate = {...deploymentTemplate};
    },

    // Stored cards are intentionally NOT frozen. Freezing them lets Vue skip
    // its deep-reactive walk, but unsafe in-place mutations elsewhere block
    // the flip. See unfurl.cloud/onecommons/unfurl-gui#149 for the call sites to fix and
    // the steps to re-enable. Look for `/* Object.freeze */` markers below.
    createTemplateResource(_state: State, target: Json) {
        // eslint-disable-next-line no-param-reassign
        if(!target.name) return;
        // TODO(#149): wrap in Object.freeze() once unsafe mutations are cleaned up.
        const card = /* Object.freeze */ ({ ...target , type: typeof(target.type) == 'string'? target.type: target?.type?.name})
        _state.resourceTemplates[target.name] = card
    },

    createReference(_state: State, { dependentName, dependentRequirement, resourceTemplate, fieldsToReplace, constraintFieldsToReplace}: Json) {
        if(!dependentName) return
        const dependent = _state.resourceTemplates[dependentName];
        console.assert(!!dependent, `Expected parent ${dependentName} to exist for ${resourceTemplate?.name}`)
        const index = dependent.dependencies.findIndex((req: Json) => req.name == dependentRequirement);
        if (resourceTemplate && resourceTemplate.name && _state.resourceTemplates[resourceTemplate.name]) {
            const prev = _state.resourceTemplates[resourceTemplate.name];
            // TODO(#149): wrap in Object.freeze() once unsafe mutations are cleaned up.
            _state.resourceTemplates[resourceTemplate.name] = /* Object.freeze */ ({...prev, dependentName, dependentRequirement});
        } else if (resourceTemplate) {
            // Not yet in state — safe to annotate the caller's object.
            resourceTemplate.dependentName = dependentName;
            resourceTemplate.dependentRequirement = dependentRequirement;
        }

        let dependency = {constraint: {match: resourceTemplate.name}, ...(dependent.dependencies[index] || {}), ...fieldsToReplace, match: resourceTemplate.name}
        if(constraintFieldsToReplace) {
            dependency = {...dependency, constraint: {...(dependency.constraint || {}), ...constraintFieldsToReplace}}
        }
        const newDependencies = index === -1
            ? [...dependent.dependencies, dependency]
            : dependent.dependencies.map((d: Json, i: number) => i === index ? dependency : d)
        // TODO(#149): wrap in Object.freeze() once unsafe mutations are cleaned up.
        const card = /* Object.freeze */ ({...dependent, dependencies: newDependencies})
        _state.resourceTemplates[dependentName] = card
    },

    deleteReference(_state: State, { dependentName, dependentRequirement }: Json) {
        if(dependentName && dependentRequirement) {
            const dependent = _state.resourceTemplates[dependentName];
            const index = dependent.dependencies.findIndex((req: Json) => req.name == dependentRequirement);
            const newDependencies = dependent.dependencies.map((d: Json, i: number) => {
                if (i !== index) return d;
                return {
                    ...d,
                    match: null,
                    completionStatus: null,
                    _valid: false,
                    constraint: {...(d.constraint || {}), match: null}
                };
            })
            // TODO(#149): wrap in Object.freeze() once unsafe mutations are cleaned up.
            const card = /* Object.freeze */ ({...dependent, dependencies: newDependencies})
            _state.resourceTemplates[dependentName] = card
            _state.resourceTemplates = {..._state.resourceTemplates};
        }
    },

    removeCard(state: State, {templateName}: Json) {
        delete state.resourceTemplates[templateName]
        // deployTooltip reads every card's statuses
        delete state.inputValidationStatus[templateName]
        state.resourceTemplates = {...state.resourceTemplates}
    },

    updateLastFetchedFrom(state: State, {projectPath, templateSlug, environmentName, noPrimary, sourceDeploymentTemplate}: Json) {
        state['lastFetchedFrom'] = {projectPath, templateSlug, environmentName, noPrimary: noPrimary ?? false, sourceDeploymentTemplate};
    },

    setContext(state: State, context: string) {
        state.context = context
    },

    templateUpdateProperty(state: State, {templateName, propertyName, propertyValue, nestedPropName}: Json) {
        const template = state.resourceTemplates[templateName]
        const targetName = nestedPropName || propertyName
        const idx = template.properties.findIndex((prop: Json) => prop.name == targetName)
        let newProperties
        if(idx >= 0) {
            newProperties = template.properties.map((p: Json, i: number) =>
                i === idx ? {...p, value: propertyValue} : p
            )
        } else {
            console.warn(`[OC] Updated a property "${propertyName}" with ${JSON.stringify(propertyValue)}.  This property was not found in the schema`)
            newProperties = [...template.properties, {name: targetName, value: propertyValue}]
        }
        // TODO(#149): wrap in Object.freeze() once unsafe mutations are cleaned up.
        const card = /* Object.freeze */ ({...template, properties: newProperties})
        state.resourceTemplates[templateName] = card
    },
}

const actions = {
    // used exclusively for /dashboard/deployment/<env>/<deployment> TODO merge with related actions
    async populateDeploymentResources({state, rootGetters, getters, commit, dispatch}: Context, {deployment, environmentName}: Json) {
        commit('resetTemplateResourceState')
        const isDeploymentTemplate = deployment.__typename == 'DeploymentTemplate'
        let deploymentTemplate = cloneDeep(rootGetters.resolveDeploymentTemplate(
            isDeploymentTemplate? deployment.name: deployment.deploymentTemplate
        ))
        if(!deploymentTemplate) {
            const message = `Could not lookup deployment blueprint '${deployment.deploymentTemplate}'`
            const e = Object.assign(new Error(message), {flash: true})
            throw e
        }
        if(!isDeploymentTemplate) deploymentTemplate = {...deploymentTemplate, ...deployment}
        let resource = isDeploymentTemplate? rootGetters.resolveResourceTemplate(deploymentTemplate.primary) : rootGetters.resolveResource(deploymentTemplate.primary)
        if(!resource) {
            const message = `Could not lookup resource '${deploymentTemplate.primary}'`
            const e = Object.assign(new Error(message), {flash: true})
            throw e
        }
        if(!isDeploymentTemplate) resource = {...resource, template: getters.dtResolveResourceTemplate(resource.template)}

        deploymentTemplate.primary = resource.name
        if(!deploymentTemplate.cloud) {
            const environment = rootGetters.lookupEnvironment(environmentName)
            if(environment?.primary_provider?.type) {
                deploymentTemplate.cloud = environment.primary_provider.type
            }
        }
        commit('updateLastFetchedFrom', {environmentName})
        commit('setDeploymentTemplate', deploymentTemplate)
        commit('createTemplateResource', resource)

        await dispatch('createMatchedResources', {resource, isDeploymentTemplate})

        // createMatchedResources only walks the dependency graph via non-null
        // `match` fields.  Templates/Resources that aren't reachable through
        // that graph (e.g. deps with match=null, or children of unreachable
        // parents) still need to appear in the deployment table.
        // Honour the same visibility rules that getCardsStacked applies.
        const pab = rootGetters.getApplicationRoot
        const allEntries = Object.entries<Json>(
            isDeploymentTemplate ? (pab?.ResourceTemplate || {}) : (pab?.Resource || {})
        )
        for(const [name, raw] of allEntries) {
            if(state.resourceTemplates[name]) continue
            if(!raw) continue
            const vis = raw.visibility || 'inherit'
            if(vis === 'hidden') continue
            commit('createTemplateResource', raw)
        }
    },

    async recursiveInstantiate({ commit, getters, rootGetters, state: _state, dispatch}: Context, node: Json) {
        const deferred = []

        const isSubstitute = node.directives?.includes('substitute')
        const nestedTemplates = getters.getNestedTemplates(node)

        for(const dep of getters.getDependencies(node)) {
            const req = dep.constraint
            if(dep.match) {
                let matchedNested

                if(nestedTemplates && (matchedNested = nestedTemplates[dep.match])) {
                    // This will create a node to be substituted
                    // NOTE: the requirement that is added is based on the dependency match rather than its name


                    const substituteDependency = isSubstitute && node.dependencies.find((otherDep: Json) => otherDep.name == dep.match)
                    const substituteNodeExists = !!(substituteDependency && getters.dtResolveResourceTemplate(substituteDependency.match))


                    if(substituteNodeExists) continue

                    const shouldPerformSubstitution = isSubstitute && !substituteDependency

                    const dependentName = node.name // the root of the inner topology
                    const dependentRequirement = shouldPerformSubstitution? dep.match : dep.name // in the case of a substitution, the name of the source template from the inner topology

                    const nameUnmangled = shouldPerformSubstitution ? `${dep.name}-for-${node.name}` : dep.match
                    let name = nameUnmangled

                    if(!shouldPerformSubstitution) {
                        name = `${name}-${dateSuffix()}`
                    }

                    matchedNested = {
                        ...matchedNested,
                        _unmangled: nameUnmangled,
                        name,
                        metadata: {created_by: 'unfurl-gui'}
                    }

                    dispatch('normalizeUnfurlData', {
                        key: "ResourceTemplate",
                        entry: matchedNested,
                        root: rootGetters.getApplicationRoot,
                    })

                    // TODO figure out the disagreement here
                    matchedNested._ancestors = [...(node._ancestors || []), [node, dependentRequirement]]

                    commit(
                        'createReference',
                        {
                            dependentName,
                            dependentRequirement,
                            resourceTemplate: matchedNested,
                            fieldsToReplace: {...dep, name: dependentRequirement},
                            constraintFieldsToReplace: {...req, match: dep.match, name: dependentRequirement}
                        }
                    )

                    commit('createTemplateResource', matchedNested)

                    commit(
                        'pushPreparedMutation',
                        createResourceTemplate({...matchedNested, dependentName, dependentRequirement, deploymentTemplateName: _state.lastFetchedFrom.templateSlug}),
                        {root: true}
                    )

                    deferred.push(dispatch('recursiveInstantiate', matchedNested))
                }
                continue
            }
            if(req.min === 0) continue
            const availableResourceTypes = getters.availableResourceTypesForRequirement(dep, true)
            // TODO also create if the only available type is not user settable

            if(availableResourceTypes.length != 1) continue

            const type = availableResourceTypes[0]

            const typeRequiresUserInteraction = (
                req.visibility == 'hidden' ||
                Object.keys(type.inputsSchema.properties).length > 0
            )

            if(!typeRequiresUserInteraction) {
                const name = `${req.name}-for-${node.name}`
                deferred.push(
                    dispatch('createNodeResource', {
                        dependentName: node.name,
                        dependentRequirement: req.name,
                        requirement: req,
                        name: name,
                        title: name,
                        visibility: 'hidden',
                        selection: type,
                    })
                )
            }
        }
        await Promise.all(deferred)
    },

    // used by deploy and blueprint editing
    async populateTemplateResources({getters, rootGetters, commit, dispatch}: Context, {projectPath, blueprintBranch, templateSlug, renameDeploymentTemplate, renamePrimary, syncState, environmentName}: Json) {
        commit('resetTemplateResourceState')
        commit('setContext', environmentName? 'template': 'blueprint')
        if(!templateSlug) return false;

        let blueprint = rootGetters.getApplicationBlueprint;
        let deploymentTemplate = rootGetters.resolveDeploymentTemplate(templateSlug)

        // attach project/branch path here so we can recall it later
        deploymentTemplate = {...deploymentTemplate, projectPath, branch: blueprintBranch}
        blueprint = {...blueprint, projectPath, branch: blueprintBranch}

        const sourceDeploymentTemplate = deploymentTemplate._sourceTemplate || deploymentTemplate.name

        if(!deploymentTemplate._sourceTemplate && renameDeploymentTemplate) {
            deploymentTemplate._sourceTemplate = deploymentTemplate.source = sourceDeploymentTemplate
            deploymentTemplate.title = renameDeploymentTemplate;
            deploymentTemplate.name = slugify(renameDeploymentTemplate);
            deploymentTemplate.slug = deploymentTemplate.name
        }
        if(environmentName) {
            const environment = rootGetters.lookupEnvironment(environmentName)
            if(environment?.primary_provider?.type) {
                deploymentTemplate.cloud = environment.primary_provider.type
            }
        }
        commit('updateLastFetchedFrom', {projectPath, templateSlug: deploymentTemplate.name, environmentName, sourceDeploymentTemplate});

        const primary = getters.dtResolveResourceTemplate(deploymentTemplate.primary)
        if(!primary) return false;

        if(renamePrimary) {
            deploymentTemplate.primary = slugify(renamePrimary);
            primary.name = slugify(renamePrimary);
            primary.title = renamePrimary;
        }

        if(syncState) {
            commit('pushPreparedMutation', (accumulator: Accumulator) => {
                const patch = {...deploymentTemplate};
                return [{target: deploymentTemplate.name, patch, typename: 'DeploymentTemplate'}];
            }, {root: true});
            if(renameDeploymentTemplate) {
                commit(
                    'pushPreparedMutation',
                    appendDeploymentTemplateInBlueprint({templateName: deploymentTemplate.name}),
                    {root: true}
                );
            }
        }


        // Register the primary template BEFORE walking its matched children.
        // `createMatchedResources` dispatches `initMatched` for each dependency
        // with a `match`, and each of those asserts that the parent template
        // (here `__primary`) is already in `state.resourceTemplates` — so if we
        // registered it afterwards every matched child would trip the assert.
        commit('clientDisregardUncommitted', {root: true})
        commit('setDeploymentTemplate', deploymentTemplate)
        commit('createTemplateResource', primary)

        await dispatch('createMatchedResources', {resource: primary, isDeploymentTemplate: true});
        await dispatch('fetchTypesForParams', {params: {}})
        await Promise.all(Object.values(state.resourceTemplates).map(rt => dispatch('recursiveInstantiate', rt)))
        return true;
    },


    async populateEnvironmentResources({getters, rootGetters, state, commit, dispatch}: Context, {resourceTemplates, environmentName}: Json) {
        commit('resetTemplateResourceState')
        commit('updateLastFetchedFrom', {environmentName, noPrimary: true});
        commit('setContext', 'environment')
        let promises = []
        for(const resource of resourceTemplates) {
            if(resource.name == 'primary_provider') continue
            promises.push(dispatch('initMatched', {
                isDeploymentTemplate: true,
                dependentName: null,
                dependentRequirement: null,
                match: resource.name,
                target: null,
                ancestors: null

            }))
        }
        await Promise.all(promises)
        let primary_provider
        if(primary_provider = rootGetters.resolveResourceTemplate('primary_provider')) {
            commit('clientDisregardUncommitted', null, {root: true})

            const createWith = {...primary_provider, title: 'Primary Provider', _permanent: true}
            if([lookupCloudProviderAlias('gcp'), lookupCloudProviderAlias('aws')].includes(primary_provider.type)) {
                commit('createTemplateResource', {...createWith, properties: []})
            } else {
                commit('createTemplateResource', createWith)
            }

            commit('setDeploymentTemplate', {primary: 'primary_provider'})
        }
    },

    async fetchDeploymentIfNeeded({getters, commit, dispatch, rootGetters}: Context, {imported}: Json) {
        let [deploymentName, ...templateName] = imported.split(':')
        templateName = templateName.join(':')
        const projectPath = rootGetters.getHomeProjectPath
        const branch = rootGetters.getCommitBranch
        const deployment = deploymentName?
            rootGetters.getDeployments.find((dep: Json) => dep.name == deploymentName):
            rootGetters.getDeployment
        deploymentName = deployment?.name || deploymentName
        const environmentName = deployment?._environment || getters.getCurrentEnvironment?.name

        let deploymentDict: Json | undefined

        function assignDeploymentDict() { deploymentDict = rootGetters.getDeploymentDictionary(deploymentName, environmentName) }

        assignDeploymentDict()

        if(!deploymentDict) {
            await dispatch('fetchDeployment',
                {
                    deploymentName,
                    environmentName,
                    projectPath,
                    branch,
                    // commitBranch might be a generated draft branch, or a ?branch=
                    // url pin round-tripped through the editor — so don't let
                    // it overwrite the project's current_branch
                    setCurrentBranch: !branch
                })
            assignDeploymentDict()
        }

        if(deploymentDict) {
            const template = rootGetters.getSharedResourceTemplate(
                deploymentName,
                environmentName,
                templateName
            )

            if(!template) {
                commit('createError', {
                    message: `Could not find template '${templateName}'`,
                    context: {
                        environmentName,
                        deploymentName
                    },
                    severity: 'minor'
                }, {root: true})
                return
            }

            if(!getters.resolveResourceTypeFromAny(template.type)) {
                const type = deploymentDict.ResourceType[template.type]
                await dispatch('useProjectState', {
                    root: {
                        ResourceType: {
                            [type.name]: type
                        },
                    },
                    shouldMerge: true
                })
            }
        }
    },

    async initMatched({state, commit, getters, dispatch, rootGetters}: Context, {match, target, isDeploymentTemplate, dependentName, dependentRequirement, ancestors, constraint}: Json) {
        if(!(match || target)) {
            return
        }
        if(state.resourceTemplates.hasOwnProperty(match)) {
            // Template was already added by a recursive sibling's
            // createMatchedResources running in parallel.  Don't re-create it,
            // but still wire up the parent→child reference so the dependency
            // renders correctly.
            if(dependentName && dependentRequirement) {
                const existing = state.resourceTemplates[match]
                commit('createReference', {dependentName, dependentRequirement, resourceTemplate: existing})
            }
            return
        }

        // populateEnvironmentResources initialises environment resources with no
        // parent by design; only a named one is expected to be there already
        console.assert(!dependentName || !!state.resourceTemplates[dependentName], `Expected '${dependentName}' to exist for its child '${target || match}'`)

        let resolvedDependencyMatch = getters.dtResolveResourceTemplate(match)

        if(!getters.dtResolveResourceTemplate(dependentName)?.directives?.includes('substitute')) {

            const matchedNested = getters.getNestedTemplates(dependentName)[match]

            if(matchedNested) {
                matchedNested._unmangled = match
                matchedNested.name = match = `${match}-${dateSuffix()}`
                commit('createReference', {dependentName, dependentRequirement, resourceTemplate: matchedNested})
                dispatch(
                    'normalizeUnfurlData', {
                        key: 'ResourceTemplate',
                        entry: matchedNested,
                        root: rootGetters.getApplicationRoot
                    })


                commit(
                    'pushPreparedMutation',
                    createResourceTemplate({...matchedNested, dependentName, dependentRequirement, deploymentTemplateName: state.lastFetchedFrom.templateSlug}),
                )
            }

            resolvedDependencyMatch = matchedNested || resolvedDependencyMatch
        }

        let environmentName = state.lastFetchedFrom?.environmentName

        if(!resolvedDependencyMatch && environmentName) {
            let matchedInstance = rootGetters.lookupConnection(environmentName, match)
            if(matchedInstance) {
                matchedInstance = cloneDeep(matchedInstance)
                const key = isDeploymentTemplate? 'ResourceTemplate': 'Resource'

                dispatch(
                    'normalizeUnfurlData', {
                        key,
                        entry: matchedInstance,
                        root: rootGetters.getApplicationRoot
                    })

                resolvedDependencyMatch = matchedInstance

                resolvedDependencyMatch.completionStatus = 'connected'
                if(state.context != 'environment') {
                    matchedInstance._external = true
                    resolvedDependencyMatch.readonly = true
                }
            }
        }


        if(!isDeploymentTemplate && resolvedDependencyMatch) {
            resolvedDependencyMatch = {...resolvedDependencyMatch, _external: true}
            // will not be resolvable for external resources
            resolvedDependencyMatch = rootGetters.resolveResource(target) || resolvedDependencyMatch
        }

        const _valid = !!(resolvedDependencyMatch)
        const id = _valid && generateCardId(resolvedDependencyMatch.name)

        if(_valid) {
            if(resolvedDependencyMatch.imported) {
                await dispatch('fetchDeploymentIfNeeded', resolvedDependencyMatch)
            }

            let _ancestors = null

            if(ancestors) {
                _ancestors = resolvedDependencyMatch._ancestors
                if(
                    (!resolvedDependencyMatch._ancestors && ancestors && !resolvedDependencyMatch.readonly) ||
                        (Array.isArray(resolvedDependencyMatch._ancestors) && resolvedDependencyMatch._ancestors.length == 0)
                ) {
                    _ancestors = ancestors.concat([[getters.dtResolveResourceTemplate(dependentName), match]])
                }
            }

            const newResource = {...resolvedDependencyMatch, _ancestors}

            commit('createTemplateResource', {
                ...newResource,
                template: !isDeploymentTemplate && resolvedDependencyMatch,
                id,
                readonly: newResource.directives?.includes('default'),
                dependentRequirement,
                dependentName,
                _valid
            })

            await dispatch('createMatchedResources', {resource: newResource, isDeploymentTemplate})
        }

    },

    async createMatchedResources({state, commit, getters, dispatch, rootGetters}: Context, {resource, isDeploymentTemplate}: Json) {
        let promises = []

        for(const dependency of getters.getDependencies(resource.name) || resource.dependencies || []) {
            promises.push(dispatch(
                'initMatched', {
                    isDeploymentTemplate,
                    dependentName: resource.name,
                    dependentRequirement: dependency.name,
                    match: dependency.match,
                    target: dependency.target,
                    ancestors: resource._ancestors,
                    constraint: dependency.constraint
                }
            ))
        }

        await Promise.all(promises)
    },

    async fetchTypesForParams({getters, commit, dispatch, rootGetters}: Context, {params}: Json={}) {
        const environmentName = getters.getCurrentEnvironmentName

        // we'll have a deployment name if we've called create_ensemble
        const deploymentName = rootGetters.lookupDeploymentOrDraft(
            getters.getDeploymentTemplate.name,
            environmentName
        )?.name


        if(params) {
            // for now we are assuming that these two fetches are redundant
            // we always prefer environment repositories when the environment is available
            const fetchPromise = environmentName?
                Promise.all([
                    dispatch('environmentFetchTypesWithParams', {environmentName, deploymentName, params}),
                    // don't fetch blueprint if deployment is already created
                    dispatch('blueprintFetchTypesWithParams', {...params, tempOnly: !!deploymentName})
                ]):
                dispatch('blueprintFetchTypesWithParams', {params})

            await fetchPromise
        }


        // this can go to the receiver since all this information is local to the store
        commit('setAvailableResourceTypes', getters.lookupConfigurableTypes(
            getters.getCurrentEnvironment || (getters.getDeploymentTemplate && {
                connections: [{type: getters.getDeploymentTemplate.cloud}]
            })
        ))
    },


    // TODO split this into two functions (one for updating state and other for serializing resourceTemplates)
    // we can use part of this function to set app state on page load
    // TODO use dependenciesFromResourceType here
    async createNodeResource({ commit, getters, rootGetters, state: _state, dispatch}: Context, {dependentName, dependentRequirement, requirement, name, title, selection, visibility}: Json) {
        let targetType
        if(selection._sourceinfo?.incomplete || selection.directives?.includes('substitute')) {
            if(selection._sourceinfo?.incomplete) {
                commit('addTempRepository', selection._sourceinfo) // consider this repository in future type calls
            }

            const environmentName = getters.getCurrentEnvironmentName
            const implementation_requirements = environmentName && rootGetters.providerTypesForEnvironment(environmentName)
            const params = {
                // we probably want all types the cloudmap repo will access for our template instantation
                // 'extends': selection.name,
                implementation_requirements,
                cloudmap: false,
            }

            await dispatch('fetchTypesForParams', {params})
            targetType = cloneDeep(getters.resolveResourceTypeFromAny(selection.name))

        } else { targetType = cloneDeep(selection) }

        const target: Card = {type: targetType, name}
        target.description = requirement?.description;
        target._valid = true;
        target.title = title;

        target._uncommitted = true
        target.__typename = 'ResourceTemplate'
        target.visibility = visibility || targetType.visibility || 'inherit'
        target.directives = targetType.directives
        target._sourceinfo = targetType._sourceinfo

        // do not pass type metadata into created templates
        target.metadata = {created_by: 'unfurl-gui'}

        const directAncestor = state.resourceTemplates[dependentName]

        dispatch(
            'normalizeUnfurlData', {
                key: 'ResourceTemplate',
                entry: target,
                root: rootGetters.getApplicationRoot
            })


        if(directAncestor) {
            const ancestorDependencies = getters.getDependencies(directAncestor)
            const inputsSchemaFromDirectAncestor = ancestorDependencies.find((dep: Json) => dep.name == dependentRequirement)?.constraint?.inputsSchema

            if(inputsSchemaFromDirectAncestor) {
                applyInputsSchema(target.type, inputsSchemaFromDirectAncestor)
            }

            target._ancestors = (directAncestor._ancestors || []).concat([[directAncestor, dependentRequirement]])
        }

        // TODO determine if this is still necessary with normalization
        try { target.properties = Object.entries<Json>(targetType.inputsSchema.properties || {}).map(([key, inProp]) => ({name: key, value: inProp.default ?? null}));}
        catch { target.properties = []; }

        if(targetType.requirements?.length > 0) {
            target.dependencies = targetType.requirements.map((req: Json) => {
                return {
                    constraint: {...req, visibility: req.visibility || 'visible'},
                    name: req.name,
                    match: req.match || null,
                    target: null
                };

            });
        }

        target.dependentName = dependentName
        target.dependentRequirement = dependentRequirement

        target.id = generateCardId(target.name);

        // FIXME these create helpers should accept meta args in a different object than target so they can be passed through as is
        if(state.context == 'environment') {
            commit(
                'pushPreparedMutation',
                createEnvironmentInstance({...target, environmentName: state.lastFetchedFrom.environmentName!}),
                {root: true}
            )
        }
        else if (state.context == 'blueprint' && (directAncestor._local || targetType.implementation_requirements.length > 0)) {
            commit(
                'pushPreparedMutation',
                createResourceTemplateInDeploymentTemplate({
                    ...target, deploymentTemplateName: _state.lastFetchedFrom.templateSlug!
                }),
                {root: true}
            )
        } else {
            commit(
                'pushPreparedMutation',
                createResourceTemplate({...target, deploymentTemplateName: _state.lastFetchedFrom.templateSlug}),
                {root: true}
            );
        }

        commit("createTemplateResource", target);

        const fieldsToReplace = {
            completionStatus: "created",
            _valid: true
        };

        commit('createReference', {dependentName, dependentRequirement, resourceTemplate: target, fieldsToReplace});
        await dispatch('createMatchedResources', {resource: target, isDeploymentTemplate: true})
        await dispatch('recursiveInstantiate', target)
        return true;
    },

    async connectNodeResource({getters, state, rootGetters, commit, dispatch}: Context, {dependentName, dependentRequirement, externalResource, resource}: Json) {
        const fieldsToReplace = {completionStatus: 'connected', _valid: true};
        const {environmentName} = state.lastFetchedFrom;
        const deploymentTemplateName = state.lastFetchedFrom.templateSlug
        let resourceTemplateNode
        const localCopy = getters.dtResolveResourceTemplate(externalResource || resource?.name)

        if(externalResource) {
            const resourceTemplate = localCopy || rootGetters.lookupConnection(environmentName, externalResource);

            const name = localCopy || shouldConnectWithoutCopy()? externalResource: `__${externalResource}`

            if(resourceTemplate.imported) {
                await dispatch('fetchDeploymentIfNeeded', resourceTemplate)
            }

            let _sourceinfo

            if(!resourceTemplate._sourceinfo) {
                const type = getters.resolveResourceTypeFromAny(resourceTemplate.type)
                _sourceinfo = type?._sourceinfo
            }

            resourceTemplateNode = {
                _sourceinfo,
                ...resourceTemplate,
                name,
                dependentName,
                directives: [],
                dependentRequirement,
                deploymentTemplateName,
                readonly: true,
                _external: !localCopy,
                __typename: 'ResourceTemplate',
            }
        } else if(resource) {
            resourceTemplateNode = {...resource, _external: !localCopy}
        } else {
            throw new Error('connectNodeResource must be called with either "resource" or "externalResource" set')
        }


        // node might have already been created
        if(! localCopy) {
            if(!shouldConnectWithoutCopy()) {
                commit(
                    'pushPreparedMutation',
                    () => [{typename: 'ResourceTemplate', patch: resourceTemplateNode, target: resourceTemplateNode.name}]
                )
            }
        }

        if(!getters.getCardsStacked.find((card: Json) => card.name == resourceTemplateNode.name)) {
            commit('createTemplateResource', resourceTemplateNode)
        }

        // no template slug on the environment page; the helper then patches the dependent at the top level
        commit('pushPreparedMutation', appendResourceTemplateInDependent({templateName: resourceTemplateNode.name, dependentName, dependentRequirement, deploymentTemplateName: deploymentTemplateName!}))

        commit('createReference', {dependentName, dependentRequirement, resourceTemplate: resourceTemplateNode, fieldsToReplace});
    },

    deleteNode({commit, dispatch, getters, state}: Context, {name, action, dependentName, dependentRequirement, recurse=true, shouldRemoveCard=undefined}: Json) {
        if(!state.resourceTemplates[name]) return
        if((!getters.getCardsStacked.find((card: Json) => card.name == name)) && state.resourceTemplates[name].metadata?.created_by != 'unfurl-gui') return
        const actionLowerCase = action.toLowerCase();

        const _shouldRemoveCard = shouldRemoveCard ?? getters.directAncestors(name).length <= 1

        if(dependentName) {
            commit('deleteReference', {
                dependentName,
                dependentRequirement,
            });
        }

        if(_shouldRemoveCard){
            if(recurse) {
                for(const templateName of getters.dependenciesRemovableWith(name)) {
                    dispatch('deleteNode', {name: templateName, action: 'delete', recurse: false, shouldRemoveCard: true})
                }
            }

            commit('removeCard', {templateName: name})

            if(state.context == 'environment') {
                commit(
                    'pushPreparedMutation',
                    deleteEnvironmentInstance({
                        templateName: name,
                        environmentName: state.lastFetchedFrom.environmentName!,
                        dependentName,
                        dependentRequirement
                    }),
                    {root: true}
                );
            }
            else {
                commit(
                    'pushPreparedMutation',
                    deleteResourceTemplate({
                        templateName: name,
                        deploymentTemplateName: getters.getDeploymentTemplate.name,
                        dependentName, dependentRequirement}),
                    {root: true}
                );
            }

            // clean up all dependencies still matched
            for(const resourceTemplate of Object.values(state.resourceTemplates)) {
                const danglingDependency = resourceTemplate.dependencies?.find((dep: Json) => dep.match == name || dep.constraint.match == name)

                if(!danglingDependency) continue

                commit(
                    'pushPreparedMutation',
                    deleteResourceTemplateInDependent({
                        dependentName: resourceTemplate.name,
                        dependentRequirement: danglingDependency.name,
                        deploymentTemplateName: state.deploymentTemplate.name
                    }),
                    {root: true}
                )
            }

        } else {
            commit('pushPreparedMutation', deleteResourceTemplateInDependent({dependentName: dependentName, dependentRequirement, deploymentTemplateName: state.deploymentTemplate.name}), {root: true});
        }

        return true
    },
    updateProperty({state, getters, commit, dispatch}: Context, options: Json) {
        const {deploymentName, templateName, propertyName, propertyValue, propertyPath, debounce}: Json = {
            propertyPath: [],
            debounce: false,
            ...options
        }

        if(debounce) {
            const handle = setTimeout(() => {
                dispatch(
                    'updateProperty',
                    {...options, debounce: false}
                )
            }, debounce)
            dispatch('updateTimeout', {deploymentName, templateName, propertyName, handle})
            return
        }
        const template = state.resourceTemplates[templateName]

        const fullPropertyPath = [...propertyPath, propertyName]
        const templatePropertyValue = template.properties.find((prop: Json) => prop.name == propertyPath[0])?.value

        const firstComponent = fullPropertyPath.shift()

        let templateNestedValue = templatePropertyValue

        for(const component of fullPropertyPath) {
            templateNestedValue = (templateNestedValue || {})[component]
        }

        if(_.isEqual(templateNestedValue ?? null, propertyValue ?? null)) return

        const update: {propertyName: string, propertyValue: unknown} = {propertyName: firstComponent, propertyValue: undefined}

        if(propertyPath.length > 0) {
            update.propertyValue = cloneDeep(templatePropertyValue || {})

            let mutProperty = update.propertyValue as Json
            for(const component of propertyPath.slice(1)) {
                if(!mutProperty[component]) {
                    mutProperty[component] = {}
                }

                mutProperty = mutProperty[component]
            }


            mutProperty[propertyName] = propertyValue
        } else {
            update.propertyValue = cloneDeep(propertyValue)
        }

        const inputsSchema = getters.resourceTemplateInputsSchema(templateName)

        commit('templateUpdateProperty', {templateName, ...update})
        if(state.context == 'environment') {
            commit(
                'pushPreparedMutation',
                updatePropertyInInstance({environmentName: state.lastFetchedFrom.environmentName!, templateName, ...update, inputsSchema})
            )
        } else {
            commit(
                'pushPreparedMutation',
                updatePropertyInResourceTemplate({deploymentName, templateName, ...update, inputsSchema})
            )
        }
    },
    // I tried this with proper commits but it performed poorly
    updateTimeout(_: Context, {key, deploymentName, templateName, propertyName, handle}: Json) {
        const _key = key || `${deploymentName}.${templateName}.${propertyName}`
        let oldHandle
        if(oldHandle = timeouts[_key]) {
            clearTimeout(oldHandle)
        }
        timeouts[_key] = handle
    },
    updateCardInputValidStatus({commit, dispatch}: Context, {card, status, debounce}: Json) {
        if(debounce) {
            const key = `card:${card.name}`
            const handle = setTimeout(() => {
                dispatch(
                    'updateCardInputValidStatus',
                    {card, status}
                )
            }, debounce)
            dispatch('updateTimeout', {key, handle})
            return
        }
        commit('setInputValidStatus', {card, path: 'all', status})
    },

};

const getters = {
    getDeploymentTemplate: (_state: State) => {
        return _state.deploymentTemplate;
    },
    getPrimaryCard: (_state: State) => {
        return _state.resourceTemplates[_state.deploymentTemplate.primary] || {};
    },
    primaryCardProperties(state: State) {
        const primary = state.resourceTemplates[state.deploymentTemplate.primary]
        switch(primary.__typename) {
            case 'Resource':
                return primary.attributes
            case 'ResourceTemplate':
                return primary.properties
        }

    },
    getCardProperties(state: State) {
        return function(card: Named) {
            const result = state.resourceTemplates[nameOf(card)]
            switch(result?.__typename) {
                case 'Resource': return result.attributes
                case 'ResourceTemplate': return result.properties
                default: return []
            }
        }
    },
    getCardType(state: State, _a: Getters, _b: unknown, rootGetters: Getters) {
        return function(card: Named) {
            const result = state.resourceTemplates[nameOf(card)]
            switch(result?.__typename) {
                case 'Resource': return (typeof result.template == 'string'? rootGetters.resolveResourceTemplate(result.template): result.template)?.type
                case 'ResourceTemplate': return result.type
                default: return result
            }
        }
    },
    getCardExtends(state: State, getters: Getters) {
        return function(card: Named) {
            return getters.resolveResourceTypeFromAny(getters.getCardType(card))?.extends ?? null
        }

    },
    constraintIsHidden(state: State, getters: Getters) {
        return function(dependentName: string, dependentRequirement: string) {
            const dep = getters.getDependencies(dependentName)
                ?.find((dep: Json) => dep.name == dependentRequirement)

            const match = dep?.match
            const constraint = dep?.constraint

            if(match && state.resourceTemplates[match]?.visibility == 'hidden') return true

            switch(constraint?.visibility) {
                case 'hidden':
                    return true
                case 'inherit':
                    // inherit from dependent card
                    return getters.cardIsHidden(dependentName)
                default: // constraints are visible by default
                    return false
            }
        }
    },
    cardIsHidden(state: State, getters: Getters) {
        return function(cardName: Named) {
            const card = getters.dtResolveResourceTemplate(cardName)
            if(!card) return false

            if(card.__typename == 'Resource') {
                return getters.resourceCardIsHidden(card)
            } else if(card.__typename == 'ResourceTemplate') {
                return getters.templateCardIsHidden(card)
            } else {
                throw new Error(
                    card.__typename ?
                    `Card "${card.title}" has __typename ${card.__typename}` :
                    `Card "${card.title}" has no typename`
                )
            }
        }
    },
    resourceCardIsHidden(state: State, getters: Getters) {
        return function(cardName: Named) {
            // TODO duplicated logic from table_data
            const card = getters.dtResolveResourceTemplate(cardName)

            return getters.templateCardIsHidden(card)
            // below implements hiding cards when they don't appear on the deployment table
        }
    },
    templateCardIsHidden(state: State, getters: Getters) {
        return function(cardName: Named) {
            const card = getters.dtResolveResourceTemplate(cardName)

            switch(card.visibility) {
                case 'hidden':
                    return true
                case 'visible':
                    return false
                default: // templates inherit by default
                    // inherit from constraint
                    return getters.constraintIsHidden(card.dependentName, card.dependentRequirement)
            }
        }
    },
    getCardsStacked: (_state: State, getters: Getters, _a: unknown, rootGetters: Getters) => {
        if(!_state.lastFetchedFrom) return []
        if(_state.lastFetchedFrom.noPrimary) return Object.values(_state.resourceTemplates).filter(rt => !_state.deploymentTemplate?.primary || rt.name != _state.deploymentTemplate.primary)
        const cards = Object.values(_state.resourceTemplates)

        const result = cards.filter(rt => {
            if(!rootGetters.REVEAL_HIDDEN_TEMPLATES && getters.cardIsHidden(rt.name)) return false
            return isStackedCard(rt, _state, getters)
        })

        // always display cards capable of incrementally deploying
        for(const card of cards) {
            if(result.some(c => c.name == card.name)) continue
            if(getters.cardCanIncrementalDeploy(card)) {
                result.push(card)
            }
        }

        return result
    },
    getCardsInTopology(state: State, getters: Getters, _: unknown, rootGetters: Getters) {
        return function(namespace: Named) {
            if(namespace == getters.getPrimaryCard.name) {
                return getters.getCardsStacked.filter((card: Json) => !card.name.includes(':'))
            } else {
                return getters.getCardsStacked.filter((card: Json) => card.name.startsWith(`${namespace}:`))
            }
        }
    },
    // Cards that getCardsStacked filtered out purely because they're hidden.
    // Used to populate the collapsible "Hidden Resources" section in the UI.
    getHiddenCardsStacked: (_state: State, getters: Getters, _a: unknown, rootGetters: Getters) => {
        if(!_state.lastFetchedFrom) return []
        if(_state.lastFetchedFrom.noPrimary) return []
        if(rootGetters.REVEAL_HIDDEN_TEMPLATES) return []

        return Object.values(_state.resourceTemplates).filter(rt =>
            getters.cardIsHidden(rt.name) && isStackedCard(rt, _state, getters)
        )
    },
    getHiddenCardsInTopology(state: State, getters: Getters) {
        return function(namespace: Named) {
            if(namespace == getters.getPrimaryCard.name) {
                return getters.getHiddenCardsStacked.filter((card: Json) => !card.name.includes(':'))
            } else {
                return getters.getHiddenCardsStacked.filter((card: Json) => card.name.startsWith(`${namespace}:`))
            }
        }
    },
    lookupVisibleCard(state: State, getters: Getters, _: unknown, rootGetters: Getters) {
        return function(cardName: Named) {
            return getters.getCardsStacked('*').find((card: Json) => card.name == cardName)
        }
    },
    getDependencies: (_state: State, getters: Getters, rootState: unknown, rootGetters: Getters) => {
        return function(resourceTemplateName: Named) {
            if(!resourceTemplateName) return null

            const rt = (
                rootGetters.resolveResource(nameOf(resourceTemplateName)) ||
                getters.dtResolveResourceTemplate(resourceTemplateName)
            )

            if(!rt) return null

            if(rt.__typename == 'Resource') {
                return rt.connections
            }

            let dependencies = cloneDeep(rt.dependencies || [])

            if(dependencies.length == 0) return []

            const requirementsFilterGroups = getters.groupRequirementFilters(resourceTemplateName)


            for(const dep of dependencies) {
                if(!requirementsFilterGroups[dep.name]?.length) continue
                dep.constraint = _.mergeWith(dep.constraint, ...requirementsFilterGroups[dep.name], customMerge)
            }

            dependencies = dependencies.filter((dep: Json) => dep.constraint.max > 0)

            if(rt.directives?.includes('substitute')) {
                dependencies = dependencies.filter((dep: Json) => {
                    for(const otherDep of dependencies) {
                        if(dep == otherDep) continue
                        if(dep.match == otherDep.name) {
                            return false
                        }
                    }
                    return true
                })
            }

            return dependencies
        };
    },
    cardStatus(state: State) {
        return function(resourceName: string) {
            return state.resourceTemplates[resourceName]?.status
        }
    },
    getBuriedDependencies(state: State, getters: Getters) {
        // Walk the dependency graph collecting buried (hidden) descendants.
        // A template's dependency `match` can point back up the graph
        // use visited set to break cycles
        function walk(cardName: Named, visited: Set<string>): Json[] {
            if(!getters.cardIsHidden(nameOf(cardName))) return []
            const card = getters.dtResolveResourceTemplate(cardName)
            if(!card) return []
            if(visited.has(card.name)) return []
            visited.add(card.name)
            const result: Json[] = []
            for(const dependency of getters.getDependencies(card.name)) {
                if(!getters.constraintIsHidden(card.name, dependency.name)) {
                    result.push({card, dependency, buried: true})
                }
                const match = dependency.target || dependency.match
                if(match) {
                    for(const buriedDescendent of walk(match, visited)) {
                        result.push(buriedDescendent)
                    }
                }
            }
            return result
        }
        return function(cardName: Named) {
            return walk(cardName, new Set())
        }
    },
    getDisplayableDependenciesByCard(state: State, getters: Getters) {
        return function(cardName: Named) {
            const card = getters.dtResolveResourceTemplate(cardName)
            const result: Json[] = []
            if(!card) return result
            for(const dependency of getters.getDependencies(card.name)) {
                if(!getters.constraintIsHidden(card.name, dependency.name)) {
                    result.push({dependency, card})
                }

                let match
                if (match = dependency.target || dependency.match) {
                    for(const buriedDescendent of getters.getBuriedDependencies(match)) {
                        result.push(buriedDescendent)
                    }
                }
            }
            return result
        }
    },
    requirementMatchIsValid: (_state: State, getters: Getters)=> function(requirement: Named) {
        return !!getters.resolveRequirementMatchTitle(requirement)
    },

    resolveRequirementMatchTitle: (_state: State, getters: Getters, _: unknown, rootGetters: Getters) => function(requirement: Named) {
        const match = typeof requirement == 'string'? requirement:
            state.context == 'deployment' ? requirement?.target : requirement?.match
        const matchInResourceTemplates = _state.resourceTemplates[match]?.title;
        if(matchInResourceTemplates) return matchInResourceTemplates;
        // TODO figure out how to handle resources of a service
        return state.context != 'environment' && rootGetters.lookupConnection(_state.lastFetchedFrom.environmentName, match)?.title;
    },

    resolveRequirementMatchChildren: (_state: State) => function(requirement: Named) {
        return walkMatchChildren(_state, requirement, new Set())
    },
    cardInputsAreValid(state: State) {
        return function(_card: Named) {
            const card = typeof(_card) == 'string'? state.resourceTemplates[_card]: _card;
            if(!card) return true
            if(card.imported) return true
            if(!card.properties?.length) return true
            return (Object.values(state.inputValidationStatus[card.name] || {})).every(status => status == 'valid')
        };
    },

    cardDependenciesAreValid(state: State, getters: Getters) {
        return function(_card: Named) {
            const card = typeof(_card) == 'string'? state.resourceTemplates[_card]: _card;
            if(!card) return true
            if(card.imported) return true
            const dependencies = getters.getDependencies(card)
            if(!dependencies?.length) return true;
            return dependencies.every((dependency: Json) => (
                (dependency.constraint.min == 0 && !dependency.match) ||
                (getters.requirementMatchIsValid(dependency) && getters.cardIsValid(dependency.match))
            ))
        };

    },

    cardIsValid(state: State, getters: Getters) {
        return function(card: Named) {
            return getters.cardInputsAreValid(card) && getters.cardDependenciesAreValid(card);
        };
    },

    lookupCardPropertyValue(state: State) {
        // TODO support attributes
        return function(card: string, property: string) {
            return state.resourceTemplates[card]?.properties?.find((prop: Json) => prop.name == property)?.value
        }
    },

    getCurrentEnvironment(state: State, _getters: Getters, _: unknown, rootGetters: Getters) {
      try {
        return rootGetters.lookupEnvironment(state.lastFetchedFrom.environmentName)
      } catch(e) {
        return null
      }
    },

    getCurrentEnvironmentName(state: State) {
        return state.lastFetchedFrom?.environmentName
    },

    getCurrentEnvironmentType(_: State, getters: Getters) {
        return getters.getCurrentEnvironment?.primary_provider?.type
    },

    instantiableResourceTypes(state: State) {
        let result = state.availableResourceTypes.filter(rt => rt.visibility != 'hidden')

        // if a type is marked as deprecated by another type among validSubclasses, filter it out
        let deprecatedTypes: string[] = []
        result.forEach(type => {
            if(type.metadata.deprecates) {
                deprecatedTypes = _.union(deprecatedTypes, type.metadata.deprecates)
            }
        })
        if(deprecatedTypes.length > 0) {
            return result.filter(type => !deprecatedTypes.includes(type.name))
        }
        return result

    },

    availableResourceTypesForRequirement(state: State, getters: Getters) {
        return function(requirement: Json | null | undefined, all = false) {
            if(!requirement) return []
            const types = all? state.availableResourceTypes: getters.instantiableResourceTypes
            let result = types.filter((type: Json) => {
                const isValidImplementation = [
                    ...(type.extends || []),
                    // allow types declaring deprecates to substitute for any type they deprecate
                    ...(type.metadata.deprecates || [])
                        .map((deprecated: Json) => getters.resolveResourceTypeFromAny(deprecated)?.extends)
                        .flat()
                ].includes(requirement.constraint?.resourceType)
                return isValidImplementation
            })


            // TODO dry this up
            if(all) {
                let deprecatedTypes: string[] = []
                result.forEach((type: Json) => {
                    if(type.metadata.deprecates) {
                        deprecatedTypes = _.union(deprecatedTypes, type.metadata.deprecates)
                    }
                })
                if(deprecatedTypes.length > 0) {
                    return result.filter((type: Json) => !deprecatedTypes.includes(type.name))
                }
            }

            return result
        }
    },

    resolveResourceTypeFromAny(state: State, getters: Getters, _b: unknown, rootGetters: Getters) {
        return function(typeName: string) {
            const environmentResourceType = rootGetters.environmentResolveResourceType(getters.getCurrentEnvironmentName, typeName)
            const dictionaryResourceType = rootGetters.resolveResourceType(typeName)

            // generally prefer environmentResourceType
            const candidates = [environmentResourceType, dictionaryResourceType].filter(type => !!type)

            const merge: Json = {}

            const icon = [environmentResourceType, dictionaryResourceType].find(type => type?.icon)?.icon
            if(icon) {
                merge["icon"] = icon
            }

            // immediately return a type if it is 'substitute' and not incomplete
            for(const type of candidates) {
                if(type._sourceinfo?.incomplete) continue
                if(type.directives?.includes('substitute') || type.metadata?.alias) return {...type, ...merge}
            }

            // prefer complete
            let result = candidates.find(type => !type._sourceinfo?.incomplete)
            result = (result || environmentResourceType || dictionaryResourceType) ?? null

            if(!result) return result
            return {...result, ...merge}
        }
    },

    lookupConfigurableTypes(state: State, getters: Getters, _b: unknown, rootGetters: Getters) {
        return function(environment: Json) {
            const resolver = rootGetters.resolveResourceTypeFromAny
            return Object.keys(
                {
                    ...rootGetters.blueprintResourceTypeDict,
                    ...rootGetters.environmentResourceTypeDict(environment)
                })
                .map(key => getters.resolveResourceTypeFromAny(key))
                .filter(rt => isConfigurable(rt, environment, resolver))
        }
    },


    dtResolveResourceTemplate(state: State, _a: Getters, _b: unknown, rootGetters: Getters) {
        return function(_resourceTemplate: Named) {
            let sourceDt, templateFromSource
            const resourceTemplate = nameOf(_resourceTemplate)

            const localTemplate = state.resourceTemplates[resourceTemplate]

            if(localTemplate && !localTemplate.directives?.includes('default')) return localTemplate

            if(sourceDt = state.lastFetchedFrom?.sourceDeploymentTemplate) {
                templateFromSource = rootGetters.resolveLocalResourceTemplate(sourceDt, resourceTemplate)
            }
            const templateFromStore = rootGetters.resolveResourceTemplate(resourceTemplate)

            if(templateFromStore && !templateFromStore.directives?.includes('default')) {
                return templateFromStore
            }

            return templateFromSource || templateFromStore || localTemplate
        }
    },

    calculateParentConstraint(state: State, getters: Getters) {
        return function(resourceTemplate: Json | string) {
            const rt = typeof resourceTemplate == 'string' || resourceTemplate.__typename == 'Resource'?
                getters.dtResolveResourceTemplate((resourceTemplate as Json)?.template || resourceTemplate) :
                resourceTemplate

            if(!rt._ancestors) return null

            // TODO rt.dependencies should have been normalized to an empty array
            const ancestorConstraints = cloneDeep(rt._ancestors || []).map(([rt, req]: [Json, string]) => rt.dependencies?.find((dep: Json) => dep.name == req)?.constraint)

            const parentConstraint = ancestorConstraints.reduce((prev: Json, cur: Json) => _.merge(cur, ...(prev?.requirementsFilter || [])), null)

            return parentConstraint
        }

    },

    groupRequirementFilters(state: State, getters: Getters) {
        return function(resourceTemplate: Json | string) {
            const parentConstraint = getters.calculateParentConstraint(resourceTemplate)
            return _.groupBy(parentConstraint?.requirementsFilter || [], 'name')
        }
    },

    resourceTemplateInputsSchema(state: State, getters: Getters) {
        return function(resourceTemplate: Json | string, {strict}: {strict?: boolean} = {}) {
            const rt = typeof resourceTemplate == 'string' || resourceTemplate.__typename == 'Resource'?
                getters.dtResolveResourceTemplate((resourceTemplate as Json)?.template || resourceTemplate) :
                resourceTemplate

            if(strict && !rt) {
                throw new Error(`Resource template '${(resourceTemplate as Json)?.template || nameOf(resourceTemplate)}' not found`)
            }
            // we don't have the resource template we need loaded
            // TODO figure out how to handle shared resources with node_filter
            if(!rt && typeof resourceTemplate == 'object' && resourceTemplate?.type) {
                return getters.resolveResourceTypeFromAny(resourceTemplate.type)?.inputsSchema
            }

            const type = cloneDeep(getters.resolveResourceTypeFromAny(rt.type))

            if(strict && type?._sourceinfo?.incomplete) {
                throw new Error(`'${type.name}' is incomplete`)
            }

            if(strict && !type?.inputsSchema) {
                throw new Error(`Could not resolve type with inputsSchema for '${rt.type}'`)
            }

            if(type?.inputsSchema) {
                applyInputsSchema(type, getters.calculateParentConstraint(resourceTemplate)?.inputsSchema)
            }

            return type?.inputsSchema
        }
    },

    lookupEnvironmentVariable(state: State, _a: Getters, _b: unknown, rootGetters: Getters) {
        return function(variableName: string | string[]) {
            const _variableName = Array.isArray(variableName)? variableName[0]: variableName
            return (
              rootGetters.lookupVariableByEnvironment(_variableName, state.lastFetchedFrom.environmentName) ||
              rootGetters.lookupVariableByEnvironment(_variableName, '*')
            )
        }
    },

    getParentDependency(state: State, getters: Getters) {
        return function(dependencyName: string) {
            console.warn('Do not use getParentDependency - a template may fill multiple dependencies')
            if(!dependencyName) return null
            let primaryName = state.deploymentTemplate.primary
            if (dependencyName === primaryName) return null

            let dependency = state.resourceTemplates[dependencyName]
            let dependent = getters.getParentDependency(dependency.dependentName) || dependency
            return dependent
        }
    },

    getDependent(state: State) {
        return function(dependencyName: string) {
            console.warn('Do not use getDependent - a template may fill multiple dependencies')
            if(!dependencyName) return null
            let primaryName = state.deploymentTemplate.primary
            if (dependencyName === primaryName) return null

            const dependency = state.resourceTemplates[dependencyName]
            try {
                return state.resourceTemplates[dependency.dependentName]
            } catch(e) {
                console.error(e)
                return null
            }
        }
    },

    getPrimary(state: State) {
        return state.resourceTemplates[state.deploymentTemplate.primary]
    },

    cardCanIncrementalDeploy(state: State, getters: Getters) {
        return function(card: Named) {
            // NOTE: hardcoded names
            return getters.getCardExtends(card)?.find((e: Json) => e.startsWith('ContainerImageSource@'))
        }
    },

    hasIncrementalDeployOption(state: State, getters: Getters) {
        return Object.values(state.resourceTemplates).some(card => getters.cardCanIncrementalDeploy(card))
    },

    getCurrentContext(state: State) {
        return state.context
    },

    editingDeployed(state: State, getters: Getters, _b: unknown, rootGetters: Getters) {
        const deployment = rootGetters.resolveDeployment(state.deploymentTemplate.name)
        return !!deployment?.workflow
    },

    editingTorndown(state: State, getters: Getters, _b: unknown, rootGetters: Getters) {
        // TODO use deployment status
        const deployment = rootGetters.resolveDeployment(state.deploymentTemplate.name)
        return deployment?.workflow == 'undeploy'
    },

    getValidationStatuses(state: State) {
        return state.inputValidationStatus
    },

    deployTooltip(state: State, getters: Getters) {
        if(getters.cardIsValid(getters.getPrimaryCard)) return null

        // getValidationStatuses maps each card to its statuses by input path
        const statuses = Object.values(getters.getValidationStatuses as State['inputValidationStatus']).flatMap(byPath => Object.values(byPath))

        if(statuses.includes('error')) {
            return 'Some components have missing or invalid values'
        }

        if(statuses.includes('missing')) {
            return 'Some components are missing inputs'
        }

        return 'Not all required components have been created or connected'
    },

    lastFetchedFrom(state: State) { return state.lastFetchedFrom },

    getDependenciesMatchingCard(state: State) {
        return function(cardName: Named) {
            const result: Json[] = []
            Object.values(state.resourceTemplates).forEach(rt => {
                for(const dep of rt.dependencies || []) {
                    if(dep.match == cardName || dep.constraint.match == cardName) {
                        result.push(dep)
                    }
                }
            })
            return result
        }
    },

    getCardUtilization(state: State, getters: Getters) {
        return function(cardName: Named) {
            let result = 0
            getters.getDependenciesMatchingCard(cardName).forEach((dep: Json) => {
                result += dep.constraint._utilization
            })
            return result
        }
    },

    getValidConnections(state: State, getters: Getters, _a: unknown, rootGetters: Getters) {
        return function(cardName: Named, requirement: Json) {
            const card = getters.dtResolveResourceTemplate(cardName)
            const constraintType = constraintTypeFromRequirement(requirement)
            if(!(card && constraintType)) {
                return null
            }

            const result: Json[] = []

            const environmentName = state.lastFetchedFrom?.environmentName

            if(environmentName) {
                result.push(...rootGetters.getValidEnvironmentConnections(environmentName, requirement, getters.resolveResourceTypeFromAny))
            }


            const allTemplates: Json[] = _.union<string>(
                Object.keys(state.resourceTemplates),
                rootGetters.topLevelTemplates.map((rt: Json) => rt.name),
                rootGetters.localResourceTemplates(
                    getters.getDeploymentTemplate?.source || getters.getDeploymentTemplate?.name
                ).map((rt: Json) => rt.name),
            ).map(name => getters.dtResolveResourceTemplate(name))

            result.push(...allTemplates.filter((rt: Json) => {
                const type = getters.resolveResourceTypeFromAny(rt.type)
                if(! type?.extends?.includes(constraintType)) return

                // type matches

                const utilization = getters.getCardUtilization(rt.name)
                if(rt._maxUtilization >= utilization + (requirement._utilization ?? requirement.constraint?._utilization)) {
                    return true
                }
            }))

            // TODO dry this up

            let deprecatedTypes: string[] = []

            for(const template of result) {
                const templateType = getters.resolveResourceTypeFromAny(template.type)
                let deprecates
                if(deprecates = templateType?.metadata?.deprecates) {
                    deprecatedTypes = _.union(deprecates, deprecatedTypes)
                }
            }


            if(deprecatedTypes.length) {
                return result.filter(templ => !deprecatedTypes.includes(templ.type))
            }

            return result
        }
    },

    getCurrentProjectPath(state: State) {
        return state.deploymentTemplate?.projectPath
    },

    getCurrentRepositories(_a: State, getters: Getters, _b: unknown, rootGetters: Getters) {
        const result = [
            rootGetters.blueprintRepositories,
            rootGetters.currentEnvironmentRepositories(getters.getCurrentEnvironmentName)
        ]

        return result.flat()
    },

    repositoryInScope(_: State, getters: Getters) {
        return function(repo: Repository) {
            try {
                return getters.getCurrentRepositories.some((currentRepo: Repository) => importsAreEqual(currentRepo, repo))
            } catch(e) {
                console.warn(`Can't read repository url from source info: ${(e as Error).message}`)
                return true  // just assume that local file paths in url are already in scope
            }
        }
    },

    directAncestors(state: State, getters: Getters) {
        return function(card: Named) {
            const cardName = nameOf(card)
            return Object.values(state.resourceTemplates).filter(a => {
                if(a.name == cardName) return false
                // diverges from implementation in dependenciesRemovableWith
                // if(rt.metadata?.created_by != 'unfurl-gui') return false

                return a.dependencies?.some((dep: Json) => dep.match == cardName)
            })
        }
    },

    dependenciesRemovableWith(state: State, getters: Getters) {
        return function(card: Named) {
            const cardName = nameOf(card)

            const wouldBeOrphaned = getters.dtResolveResourceTemplate(cardName).dependencies.filter((dep: Json) => {
                if(!dep.match) return false

                const rt = getters.dtResolveResourceTemplate(dep.match)
                if(rt?.metadata?.created_by != 'unfurl-gui') return false

                // ancestors should be tracked
                // this is the best we can do if they weren't for some reason
                console.assert(rt._ancestors)
                if(!rt._ancestors) {
                    return true
                }

                const remainingAncestors = rt._ancestors.filter(([node, dependencyName]: [Json, string]) => {
                    if(node.name == cardName) return false
                    return node.dependencies.some((dep: Json) => dep.match == rt.name)
                })

                return remainingAncestors.length == 0
            }).map((dep: Json) => dep.match)

            return _.uniq([
                ...wouldBeOrphaned,
                ...wouldBeOrphaned.map(getters.dependenciesRemovableWith).flat()
            ])
        }
    },

    infallibleGetCardTitle(state: State, getters: Getters) {
        return function(card: Named) {
            const cardName = nameOf(card)

            return state.resourceTemplates[cardName]?.title || cardName
        }

    },

    getNestedTemplates(state: State, getters: Getters, _rootState: unknown, rootGetters: Getters) {
        // determine which nested templates are "visible" for a given template (target)
        const walk = (named: Named, seen: Set<string>): Json => {
            const target: Json | null | undefined = typeof named == 'string'? getters.dtResolveResourceTemplate(named): named
            if(!target) return {}

            let nestedTemplates = rootGetters.nestedTemplatesByPrimary[target.type?.name || target.type]
            if(nestedTemplates) {
                const cloud = getters.getDeploymentTemplate?.cloud?.split('@')?.shift()
                const nestedLocalTemplates = nestedTemplates?.local[cloud]
                return {...nestedTemplates.shared, ...nestedLocalTemplates}
            } else if(target._ancestors?.length) {
                const next = (_.last(target._ancestors) as [Json, string])[0]
                const nextName = next?.name
                // Guard against cycles in the ancestors graph — mutual deps
                // (A↔B) can produce _ancestors chains that point back at each
                // other and cause infinite recursion here.
                if(nextName && seen.has(nextName)) {
                    console.warn(`getNestedTemplates: cycle detected: ${target.name} -> ${nextName}`)
                    return {}
                }
                seen.add(target.name)
                return walk(next, seen)
            }
            return {}
        }
        return function(target: Named) {
            return walk(target, new Set())
        }
    }
};

export default {
    state,
    mutations,
    actions,
    getters
} satisfies Module<State, any>;
