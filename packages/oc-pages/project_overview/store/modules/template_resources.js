import { cloneDeep } from 'lodash';
import { __ } from "~/locale";
import { slugify } from '../../../vue_shared/util.mjs';
import {appendDeploymentTemplateInBlueprint, createResourceTemplate, deleteResourceTemplate, deleteResourceTemplateInDependent} from './deployment_template_updates.js';

const baseState = () => ({
    deploymentTemplate: {},
    resourceTemplates: {},
    inputValidationStatus: {},
});

const state = baseState();

const mutations = {
    resetTemplateResourceState(state) {
        state.deploymentTemplate = {};
        state.resourceTemplates = {};
        state.inputValidationStatus = {};
    },

    setInputValidStatus(state, {card, input, valid}) {
        const byCard = state.inputValidationStatus[card.name] || {};
        if(valid)
            byCard[input.name] = true;
        else
            delete byCard[input.name];

        state.inputValidationStatus = {...state.inputValidationStatus, [card.name]: byCard};
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

    updateLastFetchedFrom(_state, {projectPath, templateSlug, environmentName}) {
        _state.lastFetchedFrom = {projectPath, templateSlug, environmentName};
    },

    setIsDeployment(state, isDeployment) {
        state.isDeployment = isDeployment
    }
};

const actions = {
    populateDeploymentResources({rootGetters, commit, dispatch}, {deployment}) {
        commit('setIsDeployment', true)
        let deploymentTemplate = cloneDeep(rootGetters.resolveDeploymentTemplate(deployment.deploymentTemplate))
        deploymentTemplate = {...deploymentTemplate, ...deployment}
        let resource = rootGetters.resolveResource(deploymentTemplate.primary)
        resource = {...resource, template: rootGetters.resolveResourceTemplate(resource.template)}
        if(!deploymentTemplate.cloud) {
            const environment = rootGetters.lookupEnvironment(deploymentTemplate._environment)
            if(environment?.primary_provider?.type) {
                deploymentTemplate.cloud = environment.primary_provider.type
            }
        }
        commit('updateLastFetchedFrom', {environmentName: deploymentTemplate._environment})
        dispatch('createMatchedResources', {resource})
        commit('setDeploymentTemplate', deploymentTemplate)
        commit('createTemplateResource', resource)

    },

    populateTemplateResources({getters, rootGetters, state, commit, dispatch}, {projectPath, templateSlug, fetchPolicy, renameDeploymentTemplate, renamePrimary, syncState, environmentName}) {
        commit('setIsDeployment', false)
        if(!templateSlug) return false;

        const blueprint = rootGetters.getApplicationBlueprint;
        const deploymentTemplate = blueprint.getDeploymentTemplate(templateSlug);
        const primary = deploymentTemplate._primary;
        if(!primary) return false;

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

        if(syncState) {
            commit('pushPreparedMutation', (accumulator) => {
                const patch = {...deploymentTemplate};
                delete patch._state;
                delete patch._primary;
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

        commit('updateLastFetchedFrom', {projectPath, templateSlug, environmentName});
         

        function createMatchedTemplateResources(resourceTemplate) {
            if(syncState) {
                commit('pushPreparedMutation', (accumulator) => {
                    return [{target: resourceTemplate.name, patch: resourceTemplate, typename: 'ResourceTemplate'}];
                });
            }
            for(const property of resourceTemplate.properties) {
                commit('setInputValidStatus', {card: resourceTemplate, input: property, valid: !!(property.value ?? false)});
            }

            for(const dependency of resourceTemplate.dependencies) {
                if(typeof(dependency.match) != 'string') continue;
                const resolvedDependencyMatch = rootGetters.resolveResourceTemplate(dependency.match);
                dependency.valid = !!resolvedDependencyMatch;

                dependency.completionStatus = dependency.valid? 'created': null;
                const id = resolvedDependencyMatch && btoa(resolvedDependencyMatch.name).replace(/=/g, '');

                commit('createTemplateResource', {...resolvedDependencyMatch, id, dependentRequirement: dependency.name, dependentName: resourceTemplate.name});

                if(resolvedDependencyMatch) {
                    createMatchedTemplateResources(resolvedDependencyMatch);
                }
            }
        }

        createMatchedTemplateResources(primary);
        
        commit('setDeploymentTemplate', deploymentTemplate)
        commit('createTemplateResource', primary)
        return true;
    },

    createMatchedResources({commit, dispatch, rootGetters}, {resource}) {
        for(const attribute of resource.attributes) {
            commit('setInputValidStatus', {card: resource, input: attribute, valid: !!(attribute.value)})
        }
        for(const dependency of resource.dependencies) {
            const resolvedDependencyMatch = rootGetters.resolveResourceTemplate(dependency.match)
            const resolvedDependencyTarget = rootGetters.resolveResource(dependency.target)
            dependency.valid = !!(resolvedDependencyMatch && resolvedDependencyTarget)
            const id = dependency.valid && btoa(resolvedDependencyTarget.name).replace(/=/g, '')

            commit('createTemplateResource', {...resolvedDependencyTarget, template: resolvedDependencyMatch, id, dependentRequirement: dependency.name, dependentName: resource.name})

            if(dependency.valid) {
                dispatch('createMatchedResources', {resource: resolvedDependencyTarget})
            }
        }
    },


    // TODO split this into two functions (one for updating state and other for serializing resourceTemplates)
    // we can use part of this function to set app state on page load
    async createNodeResource({ commit, getters, rootGetters, state: _state, dispatch}, {dependentName, dependentRequirement, requirement, name, title, selection, action}) {
        try {
            const target = cloneDeep(selection);
            target.type = {...target};
            target.description = requirement.description;
            target.valid = true;
            target.name = name;
            target.title = title;

            delete target.__typename;
            try { target.properties = Object.values(target.inputsSchema.properties || {}).map(inProp => ({name: inProp.title, value: inProp.default ?? null}));}
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

            commit(
                'pushPreparedMutation',
                createResourceTemplate({...target, deploymentTemplateName: _state.lastFetchedFrom.templateSlug}),
                {root: true}
            );
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
        commit('createReference', {dependentName, dependentRequirement, resourceTemplate, fieldsToReplace});
    },

    async disconnectNodeResource({}, {dependentName, dependentRequirement}) {
    },

    async deleteNode({commit, dispatch, getters, state}, {name, action, dependentName, dependentRequirement}) {
        try {
            const actionLowerCase = action.toLowerCase();
            commit('deleteReference', {
                dependentName,
                dependentRequirement,
                deleteFromDeploymentTemplate: actionLowerCase == 'delete' || actionLowerCase == 'remove'
            });

            if(actionLowerCase === "delete" || actionLowerCase === 'remove') {
                commit('pushPreparedMutation', deleteResourceTemplate({templateName: name, deploymentTemplateName: getters.getDeploymentTemplate.name, dependentName, dependentRequirement}), {root: true});
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
    getCardsStacked: _state => {
        return Object.values(_state.resourceTemplates).filter((rt) => {
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
            return state.resourceTemplates[resourceName].status
        }
    },
    // TODO this is a hack and checking for name == cloud is not a permanent solution
    getDisplayableDependencies(_, getters) {
        return function(resourceTemplateName) {
            const dependencies = getters.getDependencies(resourceTemplateName)
            if(!Array.isArray(dependencies)) return []
            return dependencies.filter(dep => dep.name != 'cloud')
        }
    },
    requirementMatchIsValid: (_state, getters)=> function(requirement) {
        return typeof(requirement) == 'object'? !!getters.resolveRequirementMatchTitle(requirement): false;
    },

    resolveRequirementMatchTitle: (_state, getters, _, rootGetters) => function(requirement) { 
        const match = state.isDeployment ? requirement.target : requirement.match
        const matchInResourceTemplates = _state.resourceTemplates[match]?.title; 
        if(matchInResourceTemplates) return matchInResourceTemplates;
        // TODO figure out how to handle resources of a service
        return rootGetters.lookupConnection(_state.lastFetchedFrom.environmentName, match)?.title;
    },
    cardInputsAreValid(state) {
        return function(_card) {
            const card = typeof(_card) == 'string'? state.resourceTemplates[_card]: _card;
            if(!card?.properties?.length) return true;
            let validInputsCount;
            try {
                validInputsCount = Object.keys(state.inputValidationStatus[card.name]).length;
            } catch { return false; }
            return card.properties.length == validInputsCount;

        };
    },
    cardDependenciesAreValid(state, getters) {
        return function(_card) {
            const card = typeof(_card) == 'string'? state.resourceTemplates[_card]: _card;
            if(!card?.dependencies?.length) return true;
            return card.dependencies.every(dependency => getters.requirementMatchIsValid(dependency.match) && getters.cardIsValid(dependency.match));
        };

    },
    cardIsValid(state, getters) {
        return function(card) {
            return getters.cardInputsAreValid(card) && getters.cardDependenciesAreValid(card);
        };
    }
};

export default {
    state,
    mutations,
    actions,
    getters
};
