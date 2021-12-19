import { cloneDeep } from 'lodash';
import { __ } from "~/locale";
import graphqlClient from '../../graphql';
import updateTemplateResource from '../../graphql/mutations/update_template_resource.mutation.graphql';

const state = {
    resourcesOfTemplates: {},
    templateResourceScafold: {
        title: '',
        type: '',
        description: __('A short description of the template can be showed here'),
        status: null,
        inputs: []

    },
    cards: [],
};

const deleteReference = (arrg, by, value, nestingKey, parent ) => (
    Object.values(arrg).reduce((a, item) => {
        if (a) return a;
        if (item[by] === value ) {
            item.fullfilled_by =  null;
            item.connectedOrCreated = null;
            item.status = null;
            return item;
        }
        if(item[nestingKey]) return deleteReference(item[nestingKey], by, value, nestingKey, item);
    }, null)
);

const mutations = {
    setTemplateResources(_state, resourcesObject) {
        // eslint-disable-next-line no-param-reassign
        _state.resourcesOfTemplates = { ...resourcesObject };
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
    createTemplateResource(_state, { titleKey, nodeObject}) {
        // eslint-disable-next-line no-param-reassign
        _state.resourcesOfTemplates[titleKey] = { ...nodeObject };
    },

    createReferenceInPrimary(_state, { titleKey, requirementTitle, fieldsToReplace }){
        const index = _state.resourcesOfTemplates[titleKey].requirements.map((e) =>  e.title ).indexOf(requirementTitle);
        Object.keys(fieldsToReplace).forEach((key) => {
            // eslint-disable-next-line no-param-reassign
            _state.resourcesOfTemplates[titleKey].requirements[index][key] = fieldsToReplace[key];
        });
    },

    putCardInStack(_state, { card, position=null }) {
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

    deleteReferencePrimary(_state, {title}) {
        const index = _state.resourcesOfTemplates.primary.requirements.map((e) =>  e.fullfilled_by).indexOf(title);
        if(index !== -1){
            const element = _state.resourcesOfTemplates.primary.requirements[index];
            element.fullfilled_by = null;
            element.connectedOrCreated = null;
            element.status = null;
            // eslint-disable-next-line no-param-reassign
            _state.resourcesOfTemplates.primary.requirements[index] = { ...element };
            // eslint-disable-next-line no-param-reassign
            _state.resourcesOfTemplates.primary.status = null;
        }
    },

    deleteReferenceSubrequirements(_state, {title, titleKey}) {
        const index = _state.resourcesOfTemplates[titleKey].requirements.map((e) =>  e.fullfilled_by).indexOf(title);
        if(index !== -1){
            const element = _state.resourcesOfTemplates[titleKey].requirements[index];
            element.fullfilled_by = null;
            element.connectedOrCreated = null;
            element.status = null;
            // eslint-disable-next-line no-param-reassign
            _state.resourcesOfTemplates[titleKey].requirements[index] = { ...element };
            // eslint-disable-next-line no-param-reassign
            _state.resourcesOfTemplates[titleKey].status = null;
        }
    },

    deleteNodeResource(_state, {title}) {
        const copy = cloneDeep(_state.resourcesOfTemplates);
        // eslint-disable-next-line no-prototype-builtins
        if(copy[title].hasOwnProperty('requirements')){
            copy[title].requirements.forEach((re) => {
                delete copy[re.fullfilled_by];
            });
        }
        delete copy[title];
        // eslint-disable-next-line no-param-reassign
        _state.resourcesOfTemplates = {...copy};
    },

    deleteNodeOfStack(_state, {title}) {
        const copyCards = cloneDeep(_state.cards);
        const index = copyCards.map(card => card.title).indexOf(title);
        if(index !== -1){
            let keyToSearch = [title];
            const card = copyCards[index];
            // eslint-disable-next-line no-prototype-builtins
            if(card.hasOwnProperty('requirements')){
                const newKeys = card.requirements.map(c => c.fullfilled_by);
                if(newKeys.length > 0){
                    keyToSearch = [...keyToSearch, ...newKeys];
                }
            }
            const newArray = copyCards.filter(c => {
                return keyToSearch.indexOf(c.title) === -1;
            });
            // eslint-disable-next-line no-param-reassign
            _state.cards = [...newArray];
        }
    },

    deleteDeep(_state, {title}) {
        deleteReference(_state.resourcesOfTemplates, 'fullfilled_by', title, 'requirements', null);
    },
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
            throw new Error(err.message);
        }
    },

    createSubCards({commit, state: _state}) {
        try {
            const cards = cloneDeep(_state.cards);
            cards.forEach((c, idx) => {
                // eslint-disable-next-line no-prototype-builtins
                if(c.hasOwnProperty('requirements')){
                    const subRequirements = c.requirements.filter(r => r.fullfilled_by !== null && r.connectedOrCreated === "created");
                    subRequirements.forEach(r => {
                        commit("putCardInStack", { card: {..._state.resourcesOfTemplates[r.fullfilled_by]}, position: idx });
                    });
                }
            });
            return true;
        } catch(err) {
            throw new Error(err.message);
        }
    },

    setResourcesOfTemplate({commit, dispatch}, resourcesOBject) {
        try {
            const { requirements } = resourcesOBject.primary;
            const cards = requirements.filter(c => c.fullfilled_by !== null);
            cards.forEach(c => {
                if(c.connectedOrCreated === 'created'){
                    commit("putCardInStack", { card: resourcesOBject[c.fullfilled_by] });
                }
            });
            commit('setTemplateResources', resourcesOBject);
            dispatch('createSubCards');
            return true;
        } catch(err) {
            throw new Error(err.message);
        }
    },

    updateStackOfCards({commit, dispatch, state: _state}) {
        try {
            const { requirements } = _state.resourcesOfTemplates.primary;
            const cards = requirements.filter(c => c.fullfilled_by !== null && c.connectedOrCreated === 'created');
            cards.forEach(c => {
                commit("putCardInStack", { card: _state.resourcesOfTemplates[c.fullfilled_by] });
            });
            // dispatch('createSubCards');
            return true;
        } catch(err) {
            throw new Error(err.message);
        }
    },

    async savePrimaryCard({commit}, { primaryObject }) {
        try {
            commit('updatePrimaryCard', primaryObject);
            return true;
        }catch(err) {
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
                    commit('updateStackedInState', {rObject: c, key: c.title});
                });
                dispatch('setResourcesOfTemplate', _state.resourcesOfTemplates);
            }
            return true;
        }catch(err) {
            throw new Error(err.message);
        }
    },

    async createNodeResource({ commit, rootGetters, state: _state}, {titleCard, selection, action}) {
        try {
            const { requirement, titleKey } = rootGetters.getRequirementSelected;
            const { type, description } = requirement;
            const nodeTarget = cloneDeep(selection);
            nodeTarget.title = titleCard;
            nodeTarget.type = type;
            nodeTarget.description = description;
            nodeTarget.status = true;

            // Clean __typename
            delete nodeTarget.__typename;
            if(nodeTarget.inputs.length > 0) {
                nodeTarget.inputs = nodeTarget.inputs.map(i => {
                    delete i.__typename;
                    return i;
                });
            }
            if(nodeTarget.requirements.length > 0) {
                nodeTarget.requirements = nodeTarget.requirements.map(i => {
                    delete i.__typename;
                    return i;
                });
            }

            // Delete un used properties
            delete nodeTarget.name;
            delete nodeTarget.badge;
            delete nodeTarget.avatar;
            delete nodeTarget.platform;

            const fieldsToReplace = {
                fullfilled_by: titleCard,
                connectedOrCreated: "created",
                status: true
            };
            commit("createTemplateResource", { titleKey: titleCard, nodeObject: nodeTarget });
            commit("createReferenceInPrimary", { titleKey, requirementTitle: requirement.title, fieldsToReplace });
            commit("putCardInStack", { card: nodeTarget });
            return true;
        } catch(err) {
            throw new Error(err.message);
        }
    },

    async connectNodeResource({commit, rootGetters, dispatch}, { nodeTitle }) {
        try {
            const { requirement, titleKey } = rootGetters.getRequirementSelected;
            const fieldsToReplace = {
                fullfilled_by: nodeTitle,
                connectedOrCreated: "connected",
                status: true
            };
            commit("createReferenceInPrimary", { titleKey, requirementTitle: requirement.title, fieldsToReplace });
            dispatch("updateStackOfCards");
            return true;
        } catch(err) {
            throw new Error(err.message);
        }
    },

    async deleteNode({commit, dispatch, getters}, {nodeTitle, action, titleKey}) {
        try {
            await dispatch("savePrimaryCard", {primaryObject: getters.getPrimaryCard});
            await dispatch("saveResourceInState", {arrayOfCards: getters.getCardsStacked});
            const actionLowerCase = action.toLowerCase();
            if(actionLowerCase === "removefromelipsis") {
                commit("deleteDeep", {title: nodeTitle});
                commit("deleteNodeResource", {title: nodeTitle});
                commit("deleteNodeOfStack", {title: nodeTitle});
                return true;
            }
            if(titleKey !== "primary") {
                commit("deleteReferenceSubrequirements", {title: nodeTitle, titleKey});
            }else{
                commit("deleteReferencePrimary", {title: nodeTitle});
            }

            if(actionLowerCase === "remove"){
                commit("deleteNodeResource", {title: nodeTitle});
                commit("deleteNodeOfStack", {title: nodeTitle});
            }
            return true;
        } catch(err) {
            throw new Error(err.message);
        }
    },
};

const getters = {
    getResourcesOfTemplate: _state => (cloneDeep(_state.resourcesOfTemplates)),
    getPrimaryCard: _state => (cloneDeep(_state.resourcesOfTemplates.primary)),
    getCardsStacked: _state => (cloneDeep(_state.cards)),
};

export default {
    state,
    mutations,
    actions,
    getters
};