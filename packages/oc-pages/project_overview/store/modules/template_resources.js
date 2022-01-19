import { cloneDeep } from 'lodash';
import { __ } from "~/locale";
import graphqlClient from '../../graphql';
import gql from 'graphql-tag';
import updateTemplateResource from '../../graphql/mutations/update_template_resource.mutation.graphql';
import getTemplateBySlug from '../../graphql/queries/get_template_by_slug.query.graphql';
import {createResourceTemplate, deleteResourceTemplate, deleteResourceTemplateInDependent} from './deployment_template_updates.js'

const baseState = (availableResourceTypes) => ({
    resourcesOfTemplates: {//templateResourceScafold: {
        title: '',
        type: '',
        description: __('A short description of the template can be showed here'),
        status: null,
        inputs: [],
        primary: {title: '', properties: [] }

    },
    availableResourceTypes: availableResourceTypes || [],
    lastFetchedFrom: {}, 
    cards: [],
})

const state = baseState()

const mutations = {
    resetState(state) {
        Object.assign(state, baseState(state.availableResourceTypes))
    },
    setTemplateResources(_state, deploymentTemplate) {
        // eslint-disable-next-line no-param-reassign
        _state.resourcesOfTemplates = {...deploymentTemplate} 
    },

    updatePrimaryCard(_state, primaryOBject) {
        // eslint-disable-next-line no-param-reassign
        _state.resourcesOfTemplates.primary = { ...primaryOBject };
    },

    updateStackedInState(_state, {rObject, key}) {
        // eslint-disable-next-line no-param-reassign
        _state.resourcesOfTemplates[key] = { ...rObject };
    },

    updateResourceObject(_state, resourceObject) {
        // eslint-disable-next-line no-param-reassign
        _state.resourcesOfTemplates = {...resourceObject};
    },
    createTemplateResource(_state, { target }) {
        // eslint-disable-next-line no-param-reassign
        _state.resourcesOfTemplates[target.name] = { ...target };
    },

    createReference(_state, { dependentName, dependentRequirement, resourceTemplate, fieldsToReplace}){
        const dependent = _state.resourcesOfTemplates[dependentName]
        const index = dependent.dependencies.findIndex(req => req.name == dependentRequirement)
        resourceTemplate.dependentName = dependentName
        resourceTemplate.dependentRequirement = dependentRequirement
        dependent.dependencies[index] = {...dependent.dependencies[index], ...fieldsToReplace}
        dependent.dependencies[index].match = {...resourceTemplate, dependentRequirement, dependentName}
        _state.resourcesOfTemplates = {..._state.resourcesOfTemplates}
    },

    deleteReference(_state, { dependentName, dependentRequirement}) {
        const dependent = _state.resourcesOfTemplates[dependentName]
        const index = dependent.dependencies.findIndex(req => req.name == dependentRequirement)
        dependent.dependencies[index] = {...dependent.dependencies[index], match: null, completionStatus: null, status: false}
    },


    putCardInStack(_state, { card, position=null }) {
        if(!card) return
        const index = _state.cards.map(c => c.title).indexOf(card.title)

        if(index === -1 && !position){
            // _state.cards.unshift(card);
            // Stack beneath
            _state.cards.push(card);
        }else if(index === -1 && position){
            _state.cards.splice(position, 0, card);
        }else{
            Object.keys(card).forEach(key => {
                // eslint-disable-next-line no-param-reassign
                _state.cards[index][key] = card[key];
            });
        }
    },

    updateCards(_state, { cards }) {
        cards.forEach((c) => {
            // eslint-disable-next-line no-param-reassign
            _state.resourcesOfTemplates[c.title] = { ...c };
        });
    },


    deleteReferencePrimary(_state, {name}) {
        const index = _state.resourcesOfTemplates.primary.dependencies.map((e) =>  e.match.name).indexOf(name);
        if(index !== -1){
            const element = _state.resourcesOfTemplates.primary.dependencies[index];
            element.match = null;
            element.completionStatus = 'required';
            element.status = null;
            // eslint-disable-next-line no-param-reassign
            _state.resourcesOfTemplates.primary.dependencies[index] = { ...element };
            // eslint-disable-next-line no-param-reassign
            _state.resourcesOfTemplates.primary.status = null;
        }
    },
    updateLastFetchedFrom(_state, {projectPath, templateSlug}) {
      _state.lastFetchedFrom = {projectPath, templateSlug}
    },

    deleteReferenceSubrequirements(_state, {name, dependentName}) {
        const index = _state.resourcesOfTemplates[dependentName].dependencies.map((e) =>  e.match.name).indexOf(name);
        if(index !== -1){
            const element = _state.resourcesOfTemplates[dependentName].dependencies[index];
            element.match = null;
            element.completionStatus = 'required';
            element.status = null;
            // eslint-disable-next-line no-param-reassign
            _state.resourcesOfTemplates[dependentName].dependencies[index] = { ...element };
            // eslint-disable-next-line no-param-reassign
            _state.resourcesOfTemplates[dependentName].status = null;
        }
    },

    deleteNodeResource(_state, {name}) {
        const copy = cloneDeep(_state.resourcesOfTemplates);
        // eslint-disable-next-line no-prototype-builtins
        if(copy[name].hasOwnProperty('dependencies')){
            copy[name].dependencies.forEach((re) => {
                if(re.match) {
                    delete copy[re.match.name];
                }
            });
        }
        delete copy[name];
        // eslint-disable-next-line no-param-reassign
        _state.resourcesOfTemplates = {...copy};
    },

    deleteNodeOfStack(_state, {name}) {
        const copyCards = cloneDeep(_state.cards);
        const index = copyCards.map(card => card.name).indexOf(name);
        if(index !== -1){
            let keyToSearch = [name];
            const card = copyCards[index];
            // eslint-disable-next-line no-prototype-builtins
            if(card.hasOwnProperty('dependencies')){
                const newKeys = card.dependencies.map(c => c.match);
                if(newKeys.length > 0){
                    keyToSearch = [...keyToSearch, ...newKeys];
                }
            }
            const newArray = copyCards.filter(c => {
                return keyToSearch.indexOf(c.name) === -1;
            });
            // eslint-disable-next-line no-param-reassign
            _state.cards = [...newArray];
        }
    },

    // NOTE not in use
    /*
    deleteDeep(_state, {name}) {
        deleteReference(_state.resourcesOfTemplates, 'match', name, 'requirements', null);
    },
    */

    setAvailableResourceTypes(_state, {availableResourceTypes}) {
        state.availableResourceTypes = availableResourceTypes
    }
};

const actions = {
    async saveTemplateResources({commit, rootState, state: _state}) {
        try {
            const { projectPath } = rootState.project.globalVars;
            const { title } = rootState.project.template;

            const variables = {
                projectPath,
                title,
                objectResources: _state.resourcesOfTemplates
            };
            const { errors, data } = await graphqlClient.clients.defaultClient.mutate({
                mutation: updateTemplateResource,
                errorPolicy: 'all',
                variables
            });
            if ( errors ) {
                throw new Error(errors.map(e => e.message).join(", "));
            };
            const { resourceObject } = data.updateTemplateResource;
            commit('updateResourceObject', resourceObject);
            return data;
        } catch(err) {
            console.error(err)
            throw new Error(err.message);
        }
    },

    createSubCards({commit, state: _state}) {
        try {
            const cards = cloneDeep(_state.cards);
            cards.forEach((c, idx) => {
                // eslint-disable-next-line no-prototype-builtins
                if(c.hasOwnProperty('dependencies')){
                    const subRequirements = c.dependencies.filter(r => r.match !== null && r.completionStatus === "created");
                    subRequirements.forEach(r => {
                        commit("putCardInStack", { card: {..._state.resourcesOfTemplates[r.match]}, position: idx });
                    });
                }
            });
            return true;
        } catch(err) {
            console.error(err)
            throw new Error(err.message);
        }
    },


    async populateAvailableResourceTypes({commit}, {projectPath}) {
        // TODO add new properties back in
        const {errors, data} = await graphqlClient.clients.defaultClient.query({
            query: gql`
            {
                ResourceType @client {
                    name
                    title
                    implements
                    description
                    badge
                    #properties
                    outputs
                    requirements
                }
            }`,
            variables: {projectPath}
        })

        commit('setAvailableResourceTypes', {availableResourceTypes: data.ResourceType})
        
    },

    async fetchTemplateResources({state, commit, dispatch}, {projectPath, templateSlug, fetchPolicy}) {
        if(!templateSlug) return false
        commit('resetState')

        // NOTE this query doesn't filter properly
        const {errors, data} = await graphqlClient.clients.defaultClient.query({
            query: getTemplateBySlug,
            errorPolicy: 'all',
            variables: { projectPath, templateSlug, fetchPolicy },
            fetchPolicy
        })

        const blueprint = data.newApplicationBlueprint
        const deploymentTemplate = blueprint.deploymentTemplates.find(dt => dt?.slug == templateSlug)
        if(!deploymentTemplate) return false
        const {dependencies} = deploymentTemplate.primary

        for(const dependency of dependencies) {
            if(!dependency.match) continue
            dependency.status = true
            dependency.completionStatus = 'created'
            commit('putCardInStack', {card: {...dependency.match, status: true, dependentRequirement: dependency.name, dependentName: 'primary'}})
        }
        dispatch('setResourcesOfTemplate', {populate: true, deploymentTemplate})
        commit('updateLastFetchedFrom', {projectPath, templateSlug})
        return true
    },

    setResourcesOfTemplate({commit, dispatch}, {populate, deploymentTemplate}) {
        try {
            commit('setTemplateResources', deploymentTemplate);
            dispatch('createSubCards');
            return true;
        } catch(err) {
            console.error(err)
            throw new Error(err.message);
        }
    },

    updateStackOfCards({commit, dispatch, state: _state}) {
        try {
            const { dependencies } = _state.resourcesOfTemplates.primary;
            const cards = dependencies.filter(c => c.match !== null && c.completionStatus === 'created');
            cards.forEach(c => {
                commit("putCardInStack", { card: _state.resourcesOfTemplates[c.match] });
            });
            // dispatch('createSubCards');
            return true;
        } catch(err) {
            console.error(err)
            throw new Error(err.message);
        }
    },

    async savePrimaryCard({commit}, { primaryObject }) {
        try {
            commit('updatePrimaryCard', primaryObject);
            return true;
        }catch(err) {
            console.error(err)
            throw new Error(err.message);
        }
    },

    saveCards({commit}, {cards}) {
        commit('updateCards', cards);
    },

    async saveResourceInState({commit, dispatch, state: _state}, { arrayOfCards }) {
        try {
            if(arrayOfCards.length > 0){
                arrayOfCards.forEach((c) => {
                    commit('updateStackedInState', {rObject: c, key: c.name});
                });
                dispatch('setResourcesOfTemplate', {deploymentTemplate: _state.resourcesOfTemplates});
            }
            return true;
        }catch(err) {
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
            // TODO changing resource type properties
            if(target?.properties?.length > 0) {
                target.properties = target.properties.map(i => {
                    delete i.__typename;
                    return i;
                });
            }
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

            const actualName = dependentName == 'primary'? getters.getPrimaryCard.name: dependentName
            commit(
                'pushPreparedMutation',
                createResourceTemplate({type: target.type, name, title, description: target.description, deploymentTemplateSlug: _state.lastFetchedFrom.templateSlug, dependentName: actualName, dependentRequirement}),
                {root: true}
            )
            const fieldsToReplace = {
                completionStatus: "created",
                status: true
            };

            commit("createTemplateResource", { target });
            commit('createReference', {dependentName, dependentRequirement, resourceTemplate: target, fieldsToReplace})
            commit("putCardInStack", { card: target });
            return true;
        } catch(err) {
            console.error(err)
            throw new Error(err.message);
        }
    },

    async connectNodeResource({commit, rootGetters, dispatch}, { name }) {
        try {
            const { requirement, titleKey } = rootGetters.getRequirementSelected;
            const fieldsToReplace = {
                completionStatus: "connected",
                status: true
            };
            //commit("createReferenceInPrimary", { name, fieldsToReplace });
            commit('createReference', {dependentName, dependentRequirement, resourceTemplate, fieldsToReplace})
            dispatch("updateStackOfCards");
            return true;
        } catch(err) {
            console.error(err)
            throw new Error(err.message);
        }
    },

    async deleteNode({commit, dispatch, getters}, {name, action, dependentName, dependentRequirement}) {
        try {
            await dispatch("savePrimaryCard", {primaryObject: getters.getPrimaryCard});
            await dispatch("saveResourceInState", {arrayOfCards: getters.getCardsStacked});
            const actionLowerCase = action.toLowerCase();
            commit('deleteReference', {dependentName, dependentRequirement})

            const actualName = dependentName == 'primary'? getters.getPrimaryCard.name: dependentName

            if(actionLowerCase === "delete") {
                //commit("deleteDeep", {name}); // NOTE add this back in ?
                commit('pushPreparedMutation', deleteResourceTemplate({templateName: name, deploymentTemplateSlug: getters.getResourcesOfTemplate.slug}), {root: true})

                commit("deleteNodeResource", {name});
                commit("deleteNodeOfStack", {name});
                
                return true;
            }

            if(actionLowerCase === "remove"){

                commit('pushPreparedMutation', deleteResourceTemplateInDependent({dependentName: actualName, dependentRequirement}), {root: true})
                commit("deleteNodeResource", {name});
                commit("deleteNodeOfStack", {name});
            }
            return true;
        } catch(err) {
            console.error(err)
            throw new Error(err.message);
        }
    },
};

const getters = {
    getResourcesOfTemplate: _state => (cloneDeep(_state.resourcesOfTemplates)),
    getPrimaryCard: _state => (cloneDeep(_state.resourcesOfTemplates.primary)),
    getCardsStacked: _state => (cloneDeep(_state.cards)),
    getAvailableResourceTypes: _state => (cloneDeep(_state.availableResourceTypes)),

    getValidResourceTypes(state) {
        return function(dependency){
            if(!dependency) return []
            const dependencyName = typeof(dependency) == 'string'? dependency:
                dependency.resourceType || dependency.constraint && dependency.constraint.resourceType.name
            function filteredByType(typeName) {
                return state.availableResourceTypes.filter(type => {
                    return type.implements.includes(typeName)
                })
            }
            let result = filteredByType(dependencyName)

            if(result.length == 0) {
                const dependency = state.resourcesOfTemplates.primary.dependencies
                    .find(dependency => dependency.name == dependencyName)
                if(dependency) {
                    result = filteredByType(dependency.constraint.resourceType.name)
                }
            }
            
            // TODO query for this information
            const CLOUD_MAPPINGS = {
                'unfurl.nodes.AzureAccount': 'unfurl.nodes.AzureResources',
                'unfurl.nodes.GoogleCloudAccount': 'unfurl.nodes.GoogleCloudObject',
                'unfurl.nodes.AWSAccount': 'unfurl.nodes.AWSResource',
            }

            if(state.resourcesOfTemplates.cloud) {
                const allowedCloudVendor = `unfurl.nodes.${state.resourcesOfTemplates.cloud}`
                result = result.filter(type => {
                    return !type.implements.includes('unfurl.nodes.CloudObject') ||
                        type.implements.includes(CLOUD_MAPPINGS[allowedCloudVendor])

                })
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
