import { cloneDeep } from 'lodash';
import { __ } from "~/locale";
import graphqlClient from '../../graphql';
import gql from 'graphql-tag';
import updateTemplateResource from '../../graphql/mutations/update_template_resource.mutation.graphql';
import getTemplateBySlug from '../../graphql/queries/get_template_by_slug.query.graphql';
import {createResourceTemplate, deleteResourceTemplate, deleteResourceTemplateInDependent} from './deployment_template_updates.js'

const baseState = () => ({
    deploymentTemplate: {},
    resourceTemplates: {},
    inputValidationStatus: {},
})

const state = baseState()

const mutations = {
    resetTemplateResourceState(state) {
        state.deploymentTemplate = {}
        state.resourceTemplates = {}
        state.inputValidationStatus = {}
    },

    setInputValidStatus(state, {card, input, status}) {
        const byCard = state.inputValidationStatus[card.name] || {}
        if(status)
            byCard[input.name] = true
        else
            delete byCard[input.name]

        state.inputValidationStatus = {...state.inputValidationStatus, [card.name]: byCard}
    },

    setDeploymentTemplate(_state, deploymentTemplate) {
        // eslint-disable-next-line no-param-reassign
        _state.deploymentTemplate = {...deploymentTemplate}
    },

    createTemplateResource(_state, target ) {
        // eslint-disable-next-line no-param-reassign
        if(!target.name) return
        _state.resourceTemplates[target.name] = { ...target , type: typeof(target.type) == 'string'? target.type: target?.type?.name};
        _state.resourceTemplates = {..._state.resourceTemplates}
    },

    createReference(_state, { dependentName, dependentRequirement, resourceTemplate, fieldsToReplace}){
        const dependent = _state.resourceTemplates[dependentName]
        const index = dependent.dependencies.findIndex(req => req.name == dependentRequirement)
        resourceTemplate.dependentName = dependentName
        resourceTemplate.dependentRequirement = dependentRequirement
        dependent.dependencies[index] = {...dependent.dependencies[index], ...fieldsToReplace}
        dependent.dependencies[index].match = resourceTemplate.name
        _state.resourceTemplates = {..._state.resourceTemplates}
        _state.deploymentTemplate.resourceTemplates = _state.deploymentTemplate.resourceTemplates.concat(resourceTemplate.name)
        _state.deploymentTemplate = {..._state.deploymentTemplate}
    },

    deleteReference(_state, { dependentName, dependentRequirement, deleteFromDeploymentTemplate }) {
        if(dependentName && dependentRequirement) {
            const dependent = _state.resourceTemplates[dependentName]
            const index = dependent.dependencies.findIndex(req => req.name == dependentRequirement)
            const templateName = dependent.dependencies[index].match
            dependent.dependencies[index] = {...dependent.dependencies[index], match: null, completionStatus: null, status: false}

            _state.resourceTemplates[dependentName] = {...dependent}

            if(deleteFromDeploymentTemplate) {
                _state.deploymentTemplate.resourceTemplates = _state.deploymentTemplate.resourceTemplates.filter(rt => rt == templateName)
                delete _state.resourceTemplates[templateName]

            }
            _state.resourceTemplates = {..._state.resourceTemplates}
        }
    },

    updateLastFetchedFrom(_state, {projectPath, templateSlug}) {
        _state.lastFetchedFrom = {projectPath, templateSlug}
    },

};

const actions = {
    fetchTemplateResources({getters, rootGetters, state, commit, dispatch}, {projectPath, templateSlug, fetchPolicy}) {
        if(!templateSlug) return false

        const blueprint = rootGetters.getApplicationBlueprint
        const deploymentTemplate = blueprint.getDeploymentTemplate(templateSlug)
        const primary = deploymentTemplate._primary

        if(!primary) return false
        commit('updateLastFetchedFrom', {projectPath, templateSlug})
         

        function createMatchedTemplateResources(resourceTemplate) {
            for(const property of resourceTemplate.properties) {
                commit('setInputValidStatus', {card: resourceTemplate, input: property, status: !!(property.value ?? false)})
            }

            for(const dependency of resourceTemplate.dependencies) {
                if(typeof(dependency.match) != 'string') continue
                const resolvedDependencyMatch = rootGetters.resolveResourceTemplate(dependency.match)
                dependency.status = !!resolvedDependencyMatch

                dependency.completionStatus = dependency.status? 'created': null
                const id = resolvedDependencyMatch && btoa(resolvedDependencyMatch.name).replace(/=/g, '')

                commit('createTemplateResource', {...resolvedDependencyMatch, id, dependentRequirement: dependency.name, dependentName: resourceTemplate.name})

                if(resolvedDependencyMatch) {
                    createMatchedTemplateResources(resolvedDependencyMatch)
                }
            }
        }

        createMatchedTemplateResources(primary)

        
        dispatch('setResourcesOfTemplate', {populate: true, deploymentTemplate, primary})
        return true
    },

    setResourcesOfTemplate({commit, dispatch, rootGetters}, {populate, deploymentTemplate, primary, resourceTemplate}) {
        try {
            commit('setDeploymentTemplate', deploymentTemplate);
            commit('createTemplateResource', primary || resourceTemplate);
            return true;
        } catch(err) {
            console.error(err)
            throw new Error(err.message);
        }
    },


    // TODO split this into two functions (one for updating state and other for serializing resourceTemplates)
    // we can use part of this function to set app state on page load
    async createNodeResource({ commit, getters, rootGetters, state: _state, dispatch}, {dependentName, dependentRequirement, requirement, name, title, selection, action}) {
        try {
            const target = cloneDeep(selection);
            target.type = {...target};
            target.description = requirement.description;
            target.status = true;
            target.name = name
            target.title = title

            delete target.__typename;
            try { target.properties = Object.values(target.inputsSchema.properties || {}).map(inProp => ({name: inProp.title, value: inProp.default ?? null}))}
            catch { target.properties = [] }

            if(target.requirements.length > 0) {
                target.dependencies = target.requirements.map(req => {
                    return {
                        constraint: req,
                        name: req.name,
                        match: null,
                        target: null
                    }

                })

                delete target.requirements
            }

            target.dependentName = dependentName, target.dependentRequirement = dependentRequirement
            target.id = btoa(target.name).replace(/=/g, '')

            commit(
                'pushPreparedMutation',
                createResourceTemplate({...target, deploymentTemplateSlug: _state.lastFetchedFrom.templateSlug}),
                {root: true}
            )
            const fieldsToReplace = {
                completionStatus: "created",
                status: true
            };

            commit("createTemplateResource", target);
            commit('createReference', {dependentName, dependentRequirement, resourceTemplate: target, fieldsToReplace})
            return true;
        } catch(err) {
            console.error(err)
            throw new Error(err.message);
        }
    },

    async deleteNode({commit, dispatch, getters, state}, {name, action, dependentName, dependentRequirement}) {
        try {
            const actionLowerCase = action.toLowerCase();
            commit('deleteReference', {dependentName, dependentRequirement, deleteFromDeploymentTemplate: actionLowerCase == 'delete'})

            if(actionLowerCase === "delete") {
                commit('pushPreparedMutation', deleteResourceTemplate({templateName: name, deploymentTemplateSlug: getters.getDeploymentTemplate.slug}), {root: true})

                return true;
            }

            if(actionLowerCase === "remove"){

                commit('pushPreparedMutation', deleteResourceTemplateInDependent({dependentName: dependentName, dependentRequirement}), {root: true})
            }

            return true;
        } catch(err) {
            console.error(err)
            throw new Error(err.message);
        }
    },
};

const getters = {
    getDeploymentTemplate: (_state) => {
        return _state.deploymentTemplate
    },
    getPrimaryCard: (_state) => {
        return _state.resourceTemplates[_state.deploymentTemplate.primary] || {}
    },
    getCardsStacked: _state => {
        return Object.values(_state.resourceTemplates).filter((rt) => {
            const parentDependencies = _state.resourceTemplates[rt.dependentName]?.dependencies
            if(!parentDependencies) return false
            return parentDependencies.some(dep => dep.match == rt.name)
        })
    },
    getDependencies: (_state) => {
        return function(resourceTemplateName) {
            return _state.resourceTemplates[resourceTemplateName]?.dependencies
        }
    },
    matchIsValid: (_state => {
        return function(match) {
            if(typeof match == 'string') return !!_state.resourceTemplates[match]
            return false
        }
    }),
    resolveMatchTitle: (_state => {
        return function(match) { return '' + _state.resourceTemplates[match]?.title }
    }),
    cardInputsAreValid(state) {
        return function(_card) {
            const card = typeof(_card) == 'string'? state.resourceTemplates[_card]: _card
            if(!card?.properties?.length) return true
            let validInputsCount
            try {
                validInputsCount = Object.keys(state.inputValidationStatus[card.name]).length
            } catch { return false }
            return card.properties.length == validInputsCount

        }
    },
    cardDependenciesAreValid(state, getters) {
        return function(_card) {
            const card = typeof(_card) == 'string'? state.resourceTemplates[_card]: _card
            if(!card?.dependencies?.length) return true
            return card.dependencies.every(dependency => getters.matchIsValid(dependency.match) && getters.cardIsValid(dependency.match))
        }

    },
    cardIsValid(state, getters) {
        return function(card) {
            return getters.cardInputsAreValid(card) && getters.cardDependenciesAreValid(card)
        }
    }
};

export default {
    state,
    mutations,
    actions,
    getters
};
