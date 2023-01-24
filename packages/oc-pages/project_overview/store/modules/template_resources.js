import { cloneDeep, create } from 'lodash';
import _ from 'lodash'
import { __ } from "~/locale";
import { lookupCloudProviderAlias, slugify } from 'oc_vue_shared/util.mjs';
import {shouldConnectWithoutCopy} from 'oc_vue_shared/storage-keys.js';
import {appendDeploymentTemplateInBlueprint, appendResourceTemplateInDependent, createResourceTemplate, createEnvironmentInstance, deleteResourceTemplate, deleteResourceTemplateInDependent, deleteEnvironmentInstance, updatePropertyInInstance, updatePropertyInResourceTemplate} from './deployment_template_updates.js';
import Vue from 'vue'

const baseState = () => ({
    deploymentTemplate: {},
    resourceTemplates: {},
    inputValidationStatus: {},
    availableResourceTypes: [],
});

const timeouts = {}

const state = baseState();

const mutations = {
    resetTemplateResourceState(state) {
        for(const [key, value] of Object.entries(baseState())){
            Vue.set(state, key, value)
        }
    },

    setInputValidStatus(state, {card, input, status}) {
        const byCard = state.inputValidationStatus[card.name] || {};
        const inputName = input.name || input.title
        if(status)
            byCard[inputName] = true;
        else
            delete byCard[inputName];

        state.inputValidationStatus = {...state.inputValidationStatus, [card.name]: byCard};
    },
    setCardInputValidStatus(state, {card, status}) {
        Vue.set(state.inputValidationStatus, card.name, status)
    },

    setAvailableResourceTypes(state, resourceTypes) {
        state.availableResourceTypes = resourceTypes
    },

    setDeploymentTemplate(_state, deploymentTemplate) {
        // eslint-disable-next-line no-param-reassign
        _state.deploymentTemplate = {...deploymentTemplate};
    },

    createTemplateResource(_state, target ) {
        // eslint-disable-next-line no-param-reassign
        if(!target.name) return;
        Vue.set(
            _state.resourceTemplates,
            target.name,
            { ...target , type: typeof(target.type) == 'string'? target.type: target?.type?.name}
        )
    },

    createReference(_state, { dependentName, dependentRequirement, resourceTemplate, fieldsToReplace}){
        if(!dependentName) return
        const dependent = _state.resourceTemplates[dependentName];
        const index = dependent.dependencies.findIndex(req => req.name == dependentRequirement);
        resourceTemplate.dependentName = dependentName;
        resourceTemplate.dependentRequirement = dependentRequirement;
        dependent.dependencies[index] = {...dependent.dependencies[index], ...fieldsToReplace};
        dependent.dependencies[index].match = resourceTemplate.name;
        _state.resourceTemplates = {..._state.resourceTemplates};
        if(_state.deploymentTemplate.resourceTemplates)
            _state.deploymentTemplate.resourceTemplates = _state.deploymentTemplate.resourceTemplates.concat(resourceTemplate.name);
        _state.deploymentTemplate = {..._state.deploymentTemplate};
    },

    deleteReference(_state, { dependentName, dependentRequirement, deleteFromDeploymentTemplate }) {
        if(dependentName && dependentRequirement) {
            const dependent = _state.resourceTemplates[dependentName];
            const index = dependent.dependencies.findIndex(req => req.name == dependentRequirement);
            const templateName = dependent.dependencies[index].match;
            dependent.dependencies[index] = {...dependent.dependencies[index], match: null, completionStatus: null, valid: false};

            _state.resourceTemplates[dependentName] = {...dependent};

            if(deleteFromDeploymentTemplate) {
                _state.deploymentTemplate.resourceTemplates = _state.deploymentTemplate.resourceTemplates.filter(rt => rt != templateName);
               delete _state.resourceTemplates[templateName];

            }
            _state.resourceTemplates = {..._state.resourceTemplates};
        }
    },

    removeCard(state, {templateName}) {
        delete state.resourceTemplates[templateName]
        state.resourceTemplates = {...state.resourceTemplates}
    },

    updateLastFetchedFrom(state, {projectPath, templateSlug, environmentName, noPrimary, sourceDeploymentTemplate}) {
        Vue.set(state, 'lastFetchedFrom', {projectPath, templateSlug, environmentName, noPrimary: noPrimary ?? false, sourceDeploymentTemplate});
    },

    setContext(state, context) {
        state.context = context
    },

    templateUpdateProperty(state, {templateName, propertyName, propertyValue}) {
        const template = state.resourceTemplates[templateName]
        let property = template.properties.find(prop => prop.name == propertyName)
        if(property) {
            property.value = propertyValue
        } else {
            console.warn(`[OC] Updated a property "${propertyName}" with ${JSON.stringify(propertyValue)}.  This property was not found in the schema`)
            template.properties.push({name: propertyName, value: propertyValue})
        }
        Vue.set(state.resourceTemplates, templateName, template)
    },
}

const actions = {
    // iirc used exclusively for /dashboard/deployment/<env>/<deployment> TODO merge with related actions
    populateDeploymentResources({rootGetters, getters, commit, dispatch}, {deployment, environmentName}) {
        commit('resetTemplateResourceState')
        const isDeploymentTemplate = deployment.__typename == 'DeploymentTemplate'
        let deploymentTemplate = cloneDeep(rootGetters.resolveDeploymentTemplate(
            isDeploymentTemplate? deployment.name: deployment.deploymentTemplate
        ))
        if(!deploymentTemplate) {
            const message = `Could not lookup deployment blueprint '${deployment.deploymentTemplate}'`
            const e = new Error(message)
            e.flash = true
            throw e
        }
        if(!isDeploymentTemplate) deploymentTemplate = {...deploymentTemplate, ...deployment}
        let resource = isDeploymentTemplate? rootGetters.resolveResourceTemplate(deploymentTemplate.primary) : rootGetters.resolveResource(deploymentTemplate.primary)
        if(!resource) {
            const message = `Could not lookup resource '${deploymentTemplate.primary}'`
            const e = new Error(message)
            e.flash = true
            throw e
        }
        if(!isDeploymentTemplate) resource = {...resource, template: getters.lookupResourceTemplate(resource.template)}

        deploymentTemplate.primary = resource.name
        if(!deploymentTemplate.cloud) {
            const environment = rootGetters.lookupEnvironment(environmentName)
            if(environment?.primary_provider?.type) {
                deploymentTemplate.cloud = environment.primary_provider.type
            }
        }
        commit('updateLastFetchedFrom', {environmentName})
        commit('setDeploymentTemplate', deploymentTemplate)

        if(isDeploymentTemplate) {
            dispatch('createMatchedResources', {resource, isDeploymentTemplate})
            commit('createTemplateResource', resource)
        } else {
            // hacky workaround for broken dependency hierarchy in resources for default templates
            for(const resource of rootGetters.getResources) {
                commit('createTemplateResource', resource)
            }
        }

    },

    // used by deploy and blueprint editing
    populateTemplateResources({getters, rootGetters, commit, dispatch}, {projectPath, templateSlug, renameDeploymentTemplate, renamePrimary, syncState, environmentName}) {
        commit('resetTemplateResourceState')
        // TODO this doesn't make any sense to people reading this
        commit('setContext', false)
        if(!templateSlug) return false;


        let _syncState = syncState
        let blueprint = rootGetters.getApplicationBlueprint;
        let deploymentTemplate
        function setdt() { 
            deploymentTemplate = rootGetters.resolveDeploymentTemplate(templateSlug)
        }
        setdt()
        let primary
        let deploymentDict
        if(!deploymentTemplate) { // let's look up the deployment template from the deployment
            for(const dict of rootGetters.getDeploymentDictionaries) {
                if(dict._environment != environmentName) continue
                let dt
                try {dt = Object.values(dict.DeploymentTemplate)[0]} catch(e) {}
                if(dt?.slug != templateSlug && dt?.name != templateSlug) continue
                dispatch('useProjectState', {root: _.cloneDeep({...dict, ResourceType: undefined}), shouldMerge: true, projectPath})
                _syncState = false // override sync state if we just loaded this
                break
            }
            setdt()
        }
        deploymentTemplate = {...deploymentTemplate, projectPath} // attach project path here so we can recall it later
        blueprint = {...blueprint, projectPath} // maybe we want to do it here

        const sourceDeploymentTemplate = deploymentTemplate.source || deploymentTemplate.name

        if(!deploymentTemplate.source && renameDeploymentTemplate) {
            deploymentTemplate.source = sourceDeploymentTemplate
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

        primary = getters.lookupResourceTemplate(deploymentTemplate.primary)
        if(!primary) return false;
        primary = {...primary}
        // NOTE sometimes this is failing and as a bandaid I'm also doing it in project_application_blueprint

        if(renamePrimary) {
            deploymentTemplate.primary = slugify(renamePrimary);
            primary.name = slugify(renamePrimary);
            primary.title = renamePrimary;
        }

        if(!rootGetters.userCanEdit) {
            commit('setCommitBranch', deploymentTemplate.name)
        } 

        if(_syncState) {
            commit('pushPreparedMutation', (accumulator) => {
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


        dispatch('createMatchedResources', {resource: primary, isDeploymentTemplate: true});
        
        commit('clientDisregardUncommitted', {root: true})
        commit('setDeploymentTemplate', deploymentTemplate)
        commit('createTemplateResource', primary)
        return true;
    },


    // used by /dashboard/environment/<environment-name> TODO merge these actions
    populateTemplateResources2({getters, rootGetters, state, commit, dispatch}, {resourceTemplates, context, environmentName}) {
        commit('resetTemplateResourceState')
        for(const resource of resourceTemplates) {
            if(resource.name == 'primary_provider') continue
            commit('createTemplateResource', {...(rootGetters.resolveResourceTemplate(resource.name) || resource)})
        }
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
        commit('updateLastFetchedFrom', {environmentName, noPrimary: true});
        commit('setContext', context)
    },

    createMatchedResources({state, commit, getters, dispatch, rootGetters}, {resource, isDeploymentTemplate}) {
        for(const dependency of resource.dependencies) {
            if(state.resourceTemplates.hasOwnProperty(dependency.match)) {
                console.warn(`Cannot create matched resource for ${dependency.match}: already exists in store`)
                continue
            }

            let resolvedDependencyMatch = getters.lookupResourceTemplate(dependency.match)
            let environmentName = state.lastFetchedFrom?.environmentName

            if(!resolvedDependencyMatch && environmentName) {
                let matchedInstance = rootGetters.lookupConnection(environmentName, dependency.match)
                if(matchedInstance) {
                    matchedInstance = _.cloneDeep(matchedInstance)
                    dispatch('normalizeUnfurlData', {key: 'ResourceTemplate', entry: matchedInstance})
                    matchedInstance
                    resolvedDependencyMatch = matchedInstance

                    resolvedDependencyMatch.completionStatus = 'connected'
                    resolvedDependencyMatch.readonly = true
                }
            }

            let child = resolvedDependencyMatch
            if(!isDeploymentTemplate && child) {
                child = rootGetters.resolveResource(dependency.target)
            }
            const valid = !!(child)
            const id = valid && btoa(child.name).replace(/=/g, '')

            if(valid) {
                commit('createTemplateResource', {...child, template: !isDeploymentTemplate && resolvedDependencyMatch, id, dependentRequirement: dependency.name, dependentName: resource.name, valid})
                dispatch('createMatchedResources', {resource: child, isDeploymentTemplate})
            }
        }
    },


    // TODO split this into two functions (one for updating state and other for serializing resourceTemplates)
    // we can use part of this function to set app state on page load
    // TODO use dependenciesFromResourceType here
    async createNodeResource({ commit, getters, rootGetters, state: _state, dispatch}, {dependentName, dependentRequirement, requirement, name, title, selection, action}) {
        try {
            const target = cloneDeep(selection);
            target.type = {...target};
            target.description = requirement?.description;
            target.valid = true;
            target.name = name;
            target.title = title;

            target._uncommitted = true
            target.__typename = 'ResourceTemplate'
            target.visibility = target.visibility || 'inherit'
            try { target.properties = Object.entries(target.inputsSchema.properties || {}).map(([key, inProp]) => ({name: key, value: inProp.default ?? null}));}
            catch { target.properties = []; }

            if(target?.requirements?.length > 0) {
                target.dependencies = target.requirements.map(req => {
                    return {
                        constraint: {...req, visibility: req.visibility || 'visible'},
                        name: req.name,
                        match: req.match || null,
                        target: null
                    };

                });

                dispatch('createMatchedResources', {resource: target, isDeploymentTemplate: true})


                delete target.requirements;
            }

            target.dependentName = dependentName, target.dependentRequirement = dependentRequirement;
            target.id = btoa(target.name).replace(/=/g, '');

            if(state.context == 'environment') {
                commit(
                    'pushPreparedMutation',
                    createEnvironmentInstance({...target, environmentName: state.lastFetchedFrom.environmentName, dependentName, dependentRequirement})
                )
            }
            else {
                commit(
                    'pushPreparedMutation',
                    createResourceTemplate({...target, deploymentTemplateName: _state.lastFetchedFrom.templateSlug}),
                    {root: true}
                );
            }

            commit("createTemplateResource", target);

            const fieldsToReplace = {
                completionStatus: "created",
                valid: true
            };

            commit('createReference', {dependentName, dependentRequirement, resourceTemplate: target, fieldsToReplace});
            return true;
        } catch(err) {
            console.error(err);
            throw new Error(err.message);
        }
    },

    async connectNodeResource({getters, state, rootGetters, commit}, {dependentName, dependentRequirement, externalResource, resource}) {
        const fieldsToReplace = {completionStatus: 'connected', valid: true};
        const {environmentName} = state.lastFetchedFrom;
        const deploymentTemplateName = state.lastFetchedFrom.templateSlug
        let resourceTemplateNode
        if(externalResource) {
            const resourceTemplate = rootGetters.lookupConnection(environmentName, externalResource);
            const name = shouldConnectWithoutCopy()? externalResource: `__${externalResource}`
            resourceTemplateNode = {...resourceTemplate, name, dependentName, directives: [], dependentRequirement, deploymentTemplateName, readonly: true, __typename: 'ResourceTemplate'}
            if(!shouldConnectWithoutCopy()) {
                commit(
                    'pushPreparedMutation',
                    () => [{typename: 'ResourceTemplate', patch: resourceTemplateNode, target: name}]
                )
            }
            commit('pushPreparedMutation', appendResourceTemplateInDependent({templateName: name, dependentName, dependentRequirement, deploymentTemplateName}))
        } else if(resource) {
            commit(
                'pushPreparedMutation',
                () => [{typename: 'ResourceTemplate', patch: resource, target: resource.name}]
            )
            commit('pushPreparedMutation', appendResourceTemplateInDependent({templateName: resource.name, dependentName, dependentRequirement, deploymentTemplateName}))
            resourceTemplateNode = resource
        } else {
            throw new Error('connectNodeResource must be called with either "resource" or "externalResource" set')
        }

        commit('createReference', {dependentName, dependentRequirement, resourceTemplate: resourceTemplateNode, fieldsToReplace});
        commit('createTemplateResource', resourceTemplateNode)
    },

    deleteNode({commit, dispatch, getters, state}, {name, action, dependentName, dependentRequirement}) {
        if(!getters.getCardsStacked.find(card => card.name == name)) return
        try {
            const actionLowerCase = action.toLowerCase();

            for(const {card, dependency} of getters.getDisplayableDependenciesByCard(name)) {
                const match = dependency?.match
                if(!match) continue
                dispatch('deleteNode', {name: match, action, dependentName: card.name, dependentRequirement: dependency.name})
            }

            if(dependentName) {
                commit('deleteReference', {
                    dependentName,
                    dependentRequirement,
                    deleteFromDeploymentTemplate: true
                });
            } else {
                commit('removeCard', {templateName: name})
            }

            if(actionLowerCase === "delete" || actionLowerCase === 'remove') {

                if(state.context == 'environment') {
                    commit('pushPreparedMutation', deleteEnvironmentInstance({templateName: name, environmentName: state.lastFetchedFrom.environmentName, dependentName, dependentRequirement}), {root: true});
                }
                else {
                    commit('pushPreparedMutation', deleteResourceTemplate({templateName: name, deploymentTemplateName: getters.getDeploymentTemplate.name, dependentName, dependentRequirement}), {root: true});
                }
                return true;
            }

            if(actionLowerCase === "disconnect"){
                commit('pushPreparedMutation', deleteResourceTemplateInDependent({dependentName: dependentName, dependentRequirement, deploymentTemplateName: state.deploymentTemplate.name}), {root: true});
            }

            return true;
        } catch(err) {
            console.error(err);
            throw new Error(err.message);
        }
    },
    updateProperty({state, getters, commit, dispatch}, {deploymentName, templateName, propertyName, propertyValue, isSensitive, debounce, nestedPropName}) {
        if(debounce) {
            const handle = setTimeout(() => {
                dispatch(
                    'updateProperty',
                    {deploymentName, templateName, propertyName, propertyValue, isSensitive, nestedPropName}
                )
            }, debounce)
            dispatch('updateTimeout', {deploymentName, templateName, propertyName, handle})
            return
        }
        const template = state.resourceTemplates[templateName]

        const templatePropertyValue = template.properties.find(prop => prop.name == (nestedPropName || propertyName))?.value

        const update = {}
        update.propertyValue = propertyValue
        update.propertyName = nestedPropName || propertyName

        if(nestedPropName) {
            update.propertyValue = {...templatePropertyValue, [propertyName]: propertyValue}
        }

        if(_.isEqual(templatePropertyValue ?? null, update.propertyValue ?? null)) return

        commit('templateUpdateProperty', {templateName, ...update})
        if(state.context == 'environment') {
            commit(
                'pushPreparedMutation',
                updatePropertyInInstance({environmentName: state.lastFetchedFrom.environmentName, templateName, ...update, isSensitive})
            )
        } else {
            commit(
                'pushPreparedMutation',
                updatePropertyInResourceTemplate({deploymentName, templateName, ...update, isSensitive})
            )
        }
    },
    // I tried this with proper commits but it performed poorly
    updateTimeout(_, {key, deploymentName, templateName, propertyName, handle}) {
        const _key = key || `${deploymentName}.${templateName}.${propertyName}`
        let oldHandle
        if(oldHandle = timeouts[_key]) {
            clearTimeout(oldHandle)
        }
        timeouts[_key] = handle
    },    
    updateCardInputValidStatus({commit, dispatch}, {card, status, debounce}) {
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
        commit('setCardInputValidStatus', {card, status})
    },

};

const getters = {
    getDeploymentTemplate: (_state) => {
        return _state.deploymentTemplate;
    },
    getPrimaryCard: (_state) => {
        return _state.resourceTemplates[_state.deploymentTemplate.primary] || {};
    },
    primaryCardProperties(state) {
        const primary = state.resourceTemplates[state.deploymentTemplate.primary]
        switch(primary.__typename) {
            case 'Resource':
                return primary.attributes
            case 'ResourceTemplate':
                return primary.properties
        }

    },
    getCardProperties(state) {
        return function(card) {
            const result = state.resourceTemplates[card?.name || card]
            switch(result?.__typename) {
                case 'Resource': return result.attributes
                case 'ResourceTemplate': return result.properties
                default: return []
            }
        }
    },
    getCardType(state, _a, _b, rootGetters) {
        return function(card) {
            const result = state.resourceTemplates[card?.name || card]
            switch(result?.__typename) {
                case 'Resource': return (typeof result.template == 'string'? rootGetters.resolveResourceTemplate(result.template): result.template)?.type
                case 'ResourceTemplate': return result.type
                default: return result
            }
        }
    },
    getCardExtends(state, getters) {
        return function(card) {
            return getters.resolveResourceTypeFromAny(getters.getCardType(card))?.extends ?? null
        }

    },
    constraintIsHidden(state, getters) {
        return function(dependentName, dependentRequirement) {
            const constraint = state.resourceTemplates[dependentName]
                ?.dependencies?.find(dep => dep.name == dependentRequirement)
                ?.constraint

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
    cardIsHidden(state, getters) {
        return function(cardName) {
            const card = state.resourceTemplates[cardName?.name || cardName]
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
    resourceCardIsHidden(state, getters) {
        return function(card) {
            // TODO duplicated logic from table_data

            return getters.templateCardIsHidden(card)
            // below implements hiding cards when they don't appear on the deployment table
            /*
            const isVisible = card.visibility != 'hidden' && (
                card.visibility == 'visible' ||
                card.attributes?.find(a => a.name == 'id') ||
                card.attributes?.find(a => a.name == 'console_url') ||
                card.properties?.find(a => a.name == 'console_url') ||
                card.computedProperties?.find(a => a.name == 'console_url')
            )
            return !isVisible
            */
        }
    },
    templateCardIsHidden(state, getters) {
        return function(card) {

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
    getCardsStacked: (_state, getters, _a, rootGetters) => {
        if(!_state.lastFetchedFrom) return []
        if(_state.lastFetchedFrom.noPrimary) return Object.values(_state.resourceTemplates).filter(rt => !_state.deploymentTemplate?.primary || rt.name != _state.deploymentTemplate.primary)
        let cards = Object.values(_state.resourceTemplates)

        // hacky workaround for broken dependency hierarchy in resources for default templates
        const isDeployment = _state.deploymentTemplate.__typename == 'Deployment'

        const result = cards.filter((rt) => {
            if(!rootGetters.REVEAL_HIDDEN_TEMPLATES && getters.cardIsHidden(rt.name)) return false
            if(isDeployment) return !_state.deploymentTemplate?.primary || rt.name != _state.deploymentTemplate.primary
            const parentDependencies = _state.resourceTemplates[rt.dependentName]?.dependencies;
            if(!parentDependencies) return false;

            return  (
                rt.__typename == 'ResourceTemplate'?
                parentDependencies.some(dep => dep.match == rt.name):
                parentDependencies.some(dep => dep.target == rt.name)
            )
                
        });

        for(const card of cards) {
            if(result.some(c => c.name == card.name)) continue
            if(getters.getCardExtends(card)?.includes('ContainerImageSource')) {
                result.push(card)
                //result.push({...card, readonly: true})
            }
        }

        return result
    },
    getDependencies: (_state) => {
        return function(resourceTemplateName) {
            return _state.resourceTemplates[resourceTemplateName]?.dependencies || [];
        };
    },
    cardStatus(state) {
        return function(resourceName) {
            return state.resourceTemplates[resourceName]?.status
        }
    },
    getBuriedDependencies(state, getters) {
        return function(cardName) {
            if(!getters.cardIsHidden(cardName?.name || cardName)) return []
            const card = state.resourceTemplates[cardName?.name || cardName]
            const result = []
            for(const dependency of getters.getDependencies(card.name)) {
                if(!getters.constraintIsHidden(card.name, dependency.name)) {
                    result.push({card, dependency, buried: true})
                }
                let match
                if(match = dependency.target || dependency.match) { // try to support resources
                    for(const buriedDescendent of getters.getBuriedDependencies(match)) {
                        result.push(buriedDescendent)
                    }
                }
            }
            return result
        }
    },
    getDisplayableDependenciesByCard(state, getters) {
        return function(cardName) {
            const card = state.resourceTemplates[cardName?.name || cardName]
            const result = []
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
    requirementMatchIsValid: (_state, getters)=> function(requirement) {
        return !!getters.resolveRequirementMatchTitle(requirement)
    },

    resolveRequirementMatchTitle: (_state, getters, _, rootGetters) => function(requirement) { 
        const match = typeof requirement == 'string'? requirement:
            state.context == 'deployment' ? requirement.target : requirement.match
        const matchInResourceTemplates = _state.resourceTemplates[match]?.title; 
        if(matchInResourceTemplates) return matchInResourceTemplates;
        // TODO figure out how to handle resources of a service
        return state.context != 'environment' && rootGetters.lookupConnection(_state.lastFetchedFrom.environmentName, match)?.title;
    },

    resolveRequirementMatchChildren: (_state, getters) => function (requirement) {
        const match = typeof requirement == 'string'? requirement:
            state.context == 'deployment' ? requirement.target : requirement.match
        const resourceTemplate = _state.resourceTemplates[match]
        let children = []
        if (resourceTemplate?.dependencies) {
            for (const dep of resourceTemplate?.dependencies) {
                if (dep.constraint.visibility === 'visible' && dep?.completionStatus) {
                    // dependency is visible && there is completionStatus field (i think the status doesn't matter here)
                    children.push(_state.resourceTemplates[dep.match]?.title)
                } else {
                    // dependency is hidden or inherit || no completionStatus field
                    if (dep.match) {
                        children = children.concat(getters.resolveRequirementMatchChildren(dep.match))
                    }
                }
            }
        }
        return children 
    },
    cardInputsAreValid(state) {
        return function(_card) {
            const card = typeof(_card) == 'string'? state.resourceTemplates[_card]: _card;
            if(!card?.properties?.length) return true
            return (state.inputValidationStatus[card.name] || 'valid') == 'valid'
        };
    },

    cardDependenciesAreValid(state, getters) {
        return function(_card) {
            const card = typeof(_card) == 'string'? state.resourceTemplates[_card]: _card;
            if(!card?.dependencies?.length) return true;
            return card.dependencies.every(dependency => (
                (dependency.constraint.min == 0 && !dependency.match) ||
                (getters.requirementMatchIsValid(dependency) && getters.cardIsValid(dependency.match))
            ))
        };

    },

    cardIsValid(state, getters) {
        return function(card) {
            return getters.cardInputsAreValid(card) && getters.cardDependenciesAreValid(card);
        };
    },

    lookupCardPropertyValue(state) {
        // TODO support attributes
        return function(card, property) {
            return state.resourceTemplates[card]?.properties?.find(prop => prop.name == property)?.value
        }
    },

    getCurrentEnvironment(state, _getters, _, rootGetters) {
      try {
        return rootGetters.lookupEnvironment(state.lastFetchedFrom.environmentName)
      } catch(e) {
        return null
      }
    },

    getCurrentEnvironmentName(state) {
        return state.lastFetchedFrom.environmentName
    },

    getCurrentEnvironmentType(_, getters) {
        return getters.getCurrentEnvironment?.primary_provider?.type
    },

    instantiableResourceTypes(state) {
        return state.availableResourceTypes.filter(rt => rt.visibility != 'hidden')
    },

    availableResourceTypesForRequirement(_, getters) {
        return function(requirement) {
            if(!requirement) return []
            return getters.instantiableResourceTypes.filter(type => {
                const isValidImplementation =  type.extends?.includes(requirement.constraint?.resourceType)
                return isValidImplementation
            })
        }
    },
  
    resolveResourceTypeFromAvailable(_, getters) {
        return function(typeName) {
            return getters.instantiableResourceTypes.find(rt => rt.name == typeName)
        }
    },

    resolveResourceTypeFromAny(state, _a, _b, rootGetters) {
        return function(typeName) {
            const dictionaryResourceType = rootGetters.resolveResourceType(typeName)
            if(dictionaryResourceType) return dictionaryResourceType
            return rootGetters?.environmentResolveResourceType(state.lastFetchedFrom?.environmentName, typeName) || null
        }
    },

    lookupResourceTemplate(state, _a, _b, rootGetters) {
        return function(resourceTemplate) {
            let sourceDt, templateFromSource
            if(sourceDt = state.lastFetchedFrom?.sourceDeploymentTemplate) {
                templateFromSource = rootGetters.resolveLocalResourceTemplate(sourceDt, resourceTemplate)
            }
            const templateFromStore = rootGetters.resolveResourceTemplate(resourceTemplate)

            if(templateFromStore && !templateFromStore.directives?.includes('default')) {
                return templateFromStore
            }

            return templateFromSource || templateFromStore
        }
    },
  
    lookupEnvironmentVariable(state, _a, _b, rootGetters) {
        return function(variableName) {
            return (
              rootGetters.lookupVariableByEnvironment(variableName, state.lastFetchedFrom.environmentName) || 
              rootGetters.lookupVariableByEnvironment(variableName, '*')
            )
        }
    },

    getParentDependency(state, getters) {
        return function(dependencyName) {
            let primaryName = state.deploymentTemplate.primary 
            if (dependencyName === primaryName) return

            let dependency = state.resourceTemplates[dependencyName]
            let dependent = getters.getParentDependency(dependency.dependentName) || dependency
            return dependent
        }
    },

    getPrimary(state) {
        return state.resourceTemplates[state.deploymentTemplate.primary]
    },

    cardCanIncrementalDeploy(state, getters) {
        return function(card) {
            return getters.getCardExtends(card)?.includes('ContainerImageSource')
        }
    },

    hasIncrementalDeployOption(state, getters) {
        return Object.values(state.resourceTemplates).some(card => getters.getCardExtends(card)?.includes('ContainerImageSource'))
    },

    getCurrentContext(state) {
        return state.context
    },

    editingDeployed(state, _a, _b, rootGetters) {
        try {
            const deployment = rootGetters.resolveDeployment(state.deploymentTemplate.name)
            return  deployment.__typename == 'Deployment' && state.context === false && deployment.hasOwnProperty('status')
        }
        catch(e) {
            return false
        }
    },

    editingTorndown(_a, getters, _b, rootGetters) {
        // TODO use deployment status
        return getters.editingDeployed && rootGetters.lookupDeployPath(
            rootGetters.getDeployment?.name,
            getters.getCurrentEnvironmentName
        )?.pipeline?.variables?.WORKFLOW == 'undeploy'
    },

    getValidationStatuses(state) {
        return state.inputValidationStatus
    },

    deployTooltip(state, getters) {
        if(getters.cardIsValid(getters.getPrimaryCard)) return null

        const statuses = Object.values(getters.getValidationStatuses)

        if(statuses.includes('error')) {
            return 'Some components have missing or invalid values'
        }

        if(statuses.includes('missing')) {
            return 'Some components are missing inputs'
        }

        return 'Not all required components have been created or connected'
    },

    lastFetchedFrom(state) { return state.lastFetchedFrom }
};

export default {
    state,
    mutations,
    actions,
    getters
};
