import { cloneDeep } from 'lodash';
import _ from 'lodash'
import { __ } from "~/locale";
import { slugify } from '../../../vue_shared/util.mjs';
import {appendDeploymentTemplateInBlueprint, appendResourceTemplateInDependent, createResourceTemplate, createEnvironmentInstance, deleteResourceTemplate, deleteResourceTemplateInDependent, deleteEnvironmentInstance, updatePropertyInInstance, updatePropertyInResourceTemplate} from './deployment_template_updates.js';
import Vue from 'vue'

const baseState = () => ({
    deploymentTemplate: {},
    resourceTemplates: {},
    inputValidationStatus: {},
    availableResourceTypes: [],
});

const state = baseState();

const mutations = {
    resetTemplateResourceState(state) {
        state.deploymentTemplate = {};
        state.resourceTemplates = {};
        state.inputValidationStatus = {};
        state.context = ''
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
        console.log(card.name, status)
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
        _state.resourceTemplates[target.name] = { ...target , type: typeof(target.type) == 'string'? target.type: target?.type?.name};
        _state.resourceTemplates = {..._state.resourceTemplates};
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

    updateLastFetchedFrom(_state, {projectPath, templateSlug, environmentName, noPrimary, sourceDeploymentTemplate}) {
        _state.lastFetchedFrom = {projectPath, templateSlug, environmentName, noPrimary: noPrimary ?? false, sourceDeploymentTemplate};
    },

    setContext(state, context) {
        state.context = context
    },

    templateUpdateProperty(state, {templateName, propertyName, propertyValue}) {
        const template = state.resourceTemplates[templateName]
        template.properties.find(prop => prop.name == propertyName).value = propertyValue
        Vue.set(state.resourceTemplates, templateName, template)
    },
}

const actions = {
    // iirc used exclusively for /dashboard/deployment/<env>/<deployment> TODO merge with related actions
    populateDeploymentResources({rootGetters, getters, commit, dispatch}, {deployment, environmentName}) {
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
        if(!isDeploymentTemplate) {
            if(resource.dependencies.length == 0 && (resource?.template?.dependencies?.length ?? 0) > 0) { // TODO remove this workaround
                resource.dependencies = resource.template.dependencies
                window.alert(`Your resource is missing dependencies, this is likely an export bug.  ResourceTemplate's dependencies will be used for rendering.`)
            }
            if(resource.attributes.length == 0 && (resource?.template?.properties?.length ?? 0) > 0) { // TODO remove this workaround
                resource.attributes = resource.template.properties
                window.alert(`Your resource is missing attributes, this is likely an export bug.  ResourceTemplate's properties will be used for rendering.`)
            }
        }

        deploymentTemplate.primary = resource.name
        if(!deploymentTemplate.cloud) {
            const environment = rootGetters.lookupEnvironment(environmentName)
            if(environment?.primary_provider?.type) {
                deploymentTemplate.cloud = environment.primary_provider.type
            }
        }
        commit('updateLastFetchedFrom', {environmentName})
        dispatch('createMatchedResources', {resource, isDeploymentTemplate})
        commit('setDeploymentTemplate', deploymentTemplate)
        commit('createTemplateResource', resource)

    },

    // used by deploy and blueprint editing
    populateTemplateResources({getters, rootGetters, state, commit, dispatch}, {projectPath, templateSlug, fetchPolicy, renameDeploymentTemplate, renamePrimary, syncState, environmentName}) {
        commit('setContext', false)
        if(!templateSlug) return false;

        let _syncState = syncState
        let blueprint = rootGetters.getApplicationBlueprint;
        let deploymentTemplate
        function setdt() { deploymentTemplate = blueprint.getDeploymentTemplate(templateSlug); }
        setdt()
        let primary
        let deploymentDict
        if(!deploymentTemplate) { // let's look up the deployment template from the deployment
            for(const dict of rootGetters.getDeploymentDictionaries) {
                if(dict._environment != environmentName) continue
                let dt
                try {dt = Object.values(dict.DeploymentTemplate)[0]} catch(e) {}
                if(dt?.slug != templateSlug) continue

                dispatch('useProjectState', {root: _.cloneDeep(dict), shouldMerge: true})
                _syncState = false // override sync state if we just loaded this
                /*
                deploymentTemplate = _.cloneDeep(dt)
                primary = _.cloneDeep(dict.ResourceTemplate[deploymentTemplate.primary])
                deploymentDict = dict
                */
                break
            }
            setdt()
        }
        primary = deploymentTemplate._primary
        if(!primary) return false;
        primary = {...primary}
        deploymentTemplate = {...deploymentTemplate, projectPath} // attach project path here so we can recall it later
        blueprint = {...blueprint, projectPath} // maybe we want to do it here

        const sourceDeploymentTemplate = deploymentTemplate.name

        if(renameDeploymentTemplate) {
            deploymentTemplate.title = renameDeploymentTemplate;
            deploymentTemplate.name = slugify(renameDeploymentTemplate);
            deploymentTemplate.slug = deploymentTemplate.name
        }
        if(renamePrimary) {
            deploymentTemplate.primary = slugify(renamePrimary);
            primary.name = slugify(renamePrimary);
            primary.title = renamePrimary;
        }
        if(environmentName) {
            const environment = rootGetters.lookupEnvironment(environmentName)
            if(environment?.primary_provider?.type) {
                deploymentTemplate.cloud = environment.primary_provider.type
            }
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

        commit('updateLastFetchedFrom', {projectPath, templateSlug: deploymentTemplate.name, environmentName, sourceDeploymentTemplate});
         

        function createMatchedTemplateResources(resourceTemplate) {
            if(_syncState) {
                commit('pushPreparedMutation', (accumulator) => {
                    return [{target: resourceTemplate.name, patch: resourceTemplate, typename: 'ResourceTemplate'}];
                });
            }
            /*
            for(const property of resourceTemplate.properties) {
                commit('setInputValidStatus', {card: resourceTemplate, input: property, status: !!(property.value ?? false)});
            }
            */

            for(let dependency of resourceTemplate.dependencies) {
                if(typeof(dependency.match) != 'string') continue;
                const resolvedDependencyMatch = deploymentDict ?
                    deploymentDict.ResourceTemplate[dependency.match] :
                    getters.lookupResourceTemplate(dependency.match);
                let valid, completionStatus
                valid = !!resolvedDependencyMatch;

                completionStatus = valid? 'created': null;
                if(!completionStatus && environmentName) {
                    // TODO wrap this in a getter
                    let connected = rootGetters.lookupConnection(environmentName, dependency.match)
                    if(connected) {
                        valid = true
                        completionStatus = 'connected'
                    }
                }

                dependency = {...dependency, valid, completionStatus}

                const id = resolvedDependencyMatch && btoa(resolvedDependencyMatch.name).replace(/=/g, '');

                commit('createTemplateResource', {...resolvedDependencyMatch, id, dependentRequirement: dependency.name, dependentName: resourceTemplate.name});

                if(resolvedDependencyMatch) {
                    createMatchedTemplateResources(resolvedDependencyMatch);
                }
            }
        }

        createMatchedTemplateResources(primary);
        
        commit('clientDisregardUncommitted')
        commit('setDeploymentTemplate', deploymentTemplate)
        commit('createTemplateResource', primary)
        return true;
    },


    // used by /dashboard/environment/<environment-name> TODO merge these actions
    populateTemplateResources2({getters, rootGetters, state, commit, dispatch}, {resourceTemplates, context, environmentName}) {
        for(const resource of resourceTemplates) {
            //dispatch('createMatchedResources', {resource})
            commit('createTemplateResource', {...resource})
        }
        commit('updateLastFetchedFrom', {environmentName, noPrimary: true});
        commit('setContext', context)
    },

    // NOTE this doesn't work with instantiating from an unfurl.json blueprint because of local ResourceTemplate
    createMatchedResources({commit, getters, dispatch, rootGetters}, {resource, isDeploymentTemplate}) {
        /*
        for(const attribute of resource.attributes) {
            commit('setInputValidStatus', {card: resource, input: attribute, status: !!(attribute.value)})
        }
        */
        for(const dependency of resource.dependencies) {
            const resolvedDependencyMatch = getters.lookupResourceTemplate(dependency.match)
            let child = resolvedDependencyMatch
            if(!isDeploymentTemplate && child) {
                child = rootGetters.resolveResource(dependency.target)
            }
            const valid = !!(child)
            const id = valid && btoa(child.name).replace(/=/g, '')

            commit('createTemplateResource', {...child, template: !isDeploymentTemplate && resolvedDependencyMatch, id, dependentRequirement: dependency.name, dependentName: resource.name, valid})

            if(valid) {
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

            target.__typename = 'ResourceTemplate'
            try { target.properties = Object.entries(target.inputsSchema.properties || {}).map(([key, inProp]) => ({name: key, value: inProp.default ?? null}));}
            catch { target.properties = []; }

            if(target?.requirements?.length > 0) {
                target.dependencies = target.requirements.map(req => {
                    return {
                        constraint: req,
                        name: req.name,
                        match: null,
                        target: null
                    };

                });

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

            const fieldsToReplace = {
                completionStatus: "created",
                valid: true
            };

            commit("createTemplateResource", target);
            commit('createReference', {dependentName, dependentRequirement, resourceTemplate: target, fieldsToReplace});
            return true;
        } catch(err) {
            console.error(err);
            throw new Error(err.message);
        }
    },

    async connectNodeResource({state,rootGetters, commit}, {dependentName, dependentRequirement, nodeResource}) {

        const fieldsToReplace = {completionStatus: 'connected', valid: true};
        const {environmentName} = state.lastFetchedFrom;
        const resourceTemplate = rootGetters.lookupConnection(environmentName, nodeResource);
        commit(
            'pushPreparedMutation',
            appendResourceTemplateInDependent({dependentName, dependentRequirement, templateName: nodeResource})

        )
        commit('createReference', {dependentName, dependentRequirement, resourceTemplate, fieldsToReplace});
    },

    async disconnectNodeResource({}, {dependentName, dependentRequirement}) {
    },

    async deleteNode({commit, dispatch, getters, state}, {name, action, dependentName, dependentRequirement}) {
        try {
            const actionLowerCase = action.toLowerCase();
            if(dependentName) {
                commit('deleteReference', {
                    dependentName,
                    dependentRequirement,
                    deleteFromDeploymentTemplate: actionLowerCase == 'delete' || actionLowerCase == 'remove'
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

                commit('pushPreparedMutation', deleteResourceTemplateInDependent({dependentName: dependentName, dependentRequirement}), {root: true});
            }

            return true;
        } catch(err) {
            console.error(err);
            throw new Error(err.message);
        }
    },
    updateProperty({state, getters, commit}, {deploymentName, templateName, propertyName, propertyValue, isSensitive}) {
        //if(state.resourceTemplates[templateName].value === propertyValue) return
        const template = state.resourceTemplates[templateName]

        function toPropertyUpdate(template, propertyName, propertyValue) {
            const propertyPath = propertyName.split('.')
            let rootProperty = template.properties.find(prop => prop.name == propertyPath[0]).value //= propertyValue
            if(propertyPath.length == 1) {
                if(rootProperty === (propertyValue ?? null)) return null
                return {propertyName, propertyValue}
            }
            rootProperty = _.cloneDeep(rootProperty) // keep vuex from complaining?
            if(Array.isArray(rootProperty)) rootProperty = rootProperty.slice(0)
            let property = rootProperty

            for(const pathComponent of propertyPath.slice(1, -1)) {
                let newProperty = property[pathComponent]
                if(!newProperty) {
                    newProperty = {}
                    property[pathComponent] = newProperty
                }
                property = newProperty
            }
            const finalIndex = propertyPath[propertyPath.length -1]
            if(property[finalIndex] === (propertyValue ?? null)) return null
            property[finalIndex] = propertyValue
            return {propertyName: propertyPath[0], propertyValue: rootProperty}
        }

        const propertyUpdate = toPropertyUpdate(template, propertyName, propertyValue)
        if(!propertyUpdate) return
        
        commit('templateUpdateProperty', {templateName, ...propertyUpdate})
        if(state.context == 'environment') {
            commit(
                'pushPreparedMutation',
                updatePropertyInInstance({environmentName: state.lastFetchedFrom.environmentName, templateName, ...propertyUpdate, isSensitive})
            )
        } else {
            commit(
                'pushPreparedMutation',
                updatePropertyInResourceTemplate({deploymentName, templateName, ...propertyUpdate, isSensitive})
            )
        }
    }
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
    getCardType(state) {
        return function(card) {
            const result = state.resourceTemplates[card?.name || card]
            switch(result?.__typename) {
                case 'Resource': return result.template.type
                case 'ResourceTemplate': return result.type
                default: return result
            }
        }
    },
    cardIsHiddenByVisibilitySetting(state, getters) {
        return function(_card) {
            return false
            const card = state.resourceTemplates[_card?.name || _card]
            if(card?.visibility == 'hidden') return true
            if(card?.dependentName) {
                return getters.cardIsHiddenByVisibilitySetting(card.dependentName)
            }
            return false
        }
    },
    cardIsHiddenByConstraint(state, getters) {
        return function(_card) {
            const card = state.resourceTemplates[_card?.name || _card]
            const dependentConstraint = getters.getDependencies(card?.dependentName)
                ?.find(req => req?.match == card.name)
                ?.constraint

            if(dependentConstraint?.visibility == 'hidden') return true

            return false
        }
    },
    cardIsHidden(_, getters) {
        return function(card) {
            return getters.cardIsHiddenByVisibilitySetting(card) || getters.cardIsHiddenByConstraint(card)
        }
    },
    getCardsStacked: (_state, getters) => {
        if(_state.lastFetchedFrom.noPrimary) return Object.values(_state.resourceTemplates)
        return Object.values(_state.resourceTemplates).filter((rt) => {
            if(getters.cardIsHidden(rt.name)) return false
            const parentDependencies = _state.resourceTemplates[rt.dependentName]?.dependencies;
            if(!parentDependencies) return false;

            return  (
                rt.__typename == 'ResourceTemplate'?
                parentDependencies.some(dep => dep.match == rt.name):
                parentDependencies.some(dep => dep.target == rt.name)
            )
                
        });
    },
    getDependencies: (_state) => {
        return function(resourceTemplateName) {
            return _state.resourceTemplates[resourceTemplateName]?.dependencies;
        };
    },
    cardStatus(state) {
        return function(resourceName) {
            return state.resourceTemplates[resourceName]?.status
        }
    },
    // returns [{card, dependency}] which doesn't really make sense with the name, but I don't know what else to call it
    getDisplayableDependenciesByCard(state, getters) {
        return function(resourceTemplateName) {
            const dependencies = getters.getDependencies(resourceTemplateName)
            if(!Array.isArray(dependencies)) return []
            const ownDependencies = dependencies.filter(dep => {
                if(dep?.constraint?.visibility == 'hidden') return false
                return true
            })
            const result = []
            // requirements
            for(const dependency of ownDependencies) {
                result.push({dependency, card: state.resourceTemplates[resourceTemplateName]})
            }

            // child cards
            for(const child of getters.getDependencies(resourceTemplateName)) {
                //const match = state.resourceTemplates[child.match]
                if(getters.cardIsHiddenByConstraint(child.match)) {
                    for(const {card, dependency} of getters.getDisplayableDependenciesByCard(child.match)) {
                        if(! getters.cardIsHidden(dependency.match)) result.push({dependency, card})
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
        return rootGetters.lookupConnection(_state.lastFetchedFrom.environmentName, match)?.title;
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
            return card.dependencies.every(dependency => dependency.constraint.min == 0 || (getters.requirementMatchIsValid(dependency) && getters.cardIsValid(dependency.match)));
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
        return rootGetters.lookupEnvironment(state.lastFetchedFrom.environmentName)
    },
    currentAvailableResourceTypes(state) {
        return state.availableResourceTypes
        //disabled="getValidResourceTypes(requirement, deploymentTemplate, getCurrentEnvironment)
    },
    availableResourceTypesForRequirement(_, getters) {
        return function(requirement) {
            if(!requirement) return []
            return getters.currentAvailableResourceTypes.filter(type => {
                const isValidImplementation =  type.extends?.includes(requirement.constraint?.resourceType)
                return isValidImplementation
            })
        }
    },
    resolveResourceTypeFromAvailable(_, getters) {
        return function(typeName) {
            return getters.currentAvailableResourceTypes.find(rt => rt.name == typeName)
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
            let result, sourceDt
            if(sourceDt = state.lastFetchedFrom?.sourceDeploymentTemplate) {
                result = rootGetters.resolveLocalResourceTemplate(sourceDt, resourceTemplate)
            }
            if(!result){
                result = rootGetters.resolveResourceTemplate(resourceTemplate)
            }
            return result
        }
    }
};

export default {
    state,
    mutations,
    actions,
    getters
};
