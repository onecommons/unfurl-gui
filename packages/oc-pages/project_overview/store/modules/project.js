import { templateElement } from "@babel/types";
import _ from 'lodash';
import { __ } from "~/locale";
import graphqlClient from '../../graphql';
import createTemplate from '../../graphql/mutations/create_template.mutation.graphql';
import updateOverview from '../../graphql/mutations/update_template.mutation.graphql';
import getEnvironments from '../../graphql/queries/get_environments.query.graphql';
import getProjectInfo from '../../graphql/queries/get_project_info.query.graphql';
import getTemplateBySlug from '../../graphql/queries/get_template_by_slug.query.graphql';
import getServicesToConnect from '../../graphql/queries/get_services_to_connect.query.graphql';
import removeTemplate from '../../graphql/mutations/remove_template.mutation.graphql';


const state = {
    projectInfo: {},
    environmentList: [],
    templateList: [],
    template: {},
    requirementSelected: {
        titleKey: null,
        requirement: null
    },
    mainRequirement: {},
    globalVars: {},
    resources: [],
    servicesToConnect: []
};

const deletePropertyFromArray = (arrg) => {
    return arrg.map((arr) => {
        // eslint-disable-next-line no-underscore-dangle
        delete arr.__typename;
        return arr;
    });
};

const deleteMainRequirement = (arrg, by, value) => (
    arrg.reduce((a, item) => {
        if (a) return a;
        if (item[by] === value) {
            delete item.created;
            delete item.connected;
            delete item.requirements;
            delete item.inputs;
            item.status = null;
            item.title = item.type;
            return item;
        }
    }, null)
);

const deleteRequirementDeep = (arrg, by, value, nestingKey, parentTitle, parent ) => (
    arrg.reduce((a, item) => {
        if (a) return a;
        if (item[by] === value && parent) {
            if(parent.title === parentTitle) {
                delete item.created;
                delete item.connected;
                delete item.inputs;
                item.status = null;
                parent.status = null;
                return item;
            }
        }
        if(item[nestingKey]) return deleteRequirementDeep(item[nestingKey], by, value, nestingKey, parentTitle, item);
    }, null)
);

const findItem = (arr, key, value) => (
    arr.reduce((a, item) => {
        if (a) return a;
        if (item[key] === value) return item;
    }, null)
);

const findItemDeep = (arr, key, value, nestingKey) => (
    arr.reduce((a, item) => {
        if (a) return a;
        if (item[key] === value) return item;
        if(item[nestingKey]) return findItemDeep(item[nestingKey], key, value, nestingKey);
    }, null)
);

const updateSubrequirement = (arr, key, value, nestingKey, objectTarget, parent) => (
    arr.reduce((a, item) => {
        if (a) return a;
        if (item[key] === value) {
            if(parent){
                parent["status"] = true;
                parent["created"] = true;
                for(var x in objectTarget){
                    item[x] = objectTarget[x];
                }
                return item;
            }
        }
        if (item[nestingKey]) return updateSubrequirement(item[nestingKey], key,  value, nestingKey, objectTarget, item)
    }, null)
);

const mutations = {

    SET_PROJECT_INFO(_state,  projectInfo) {
        // eslint-disable-next-line no-param-reassign
        _state.projectInfo = { ...projectInfo };
    },

    SET_TEMPLATE_SELECTED(_state, { template }) {
        // eslint-disable-next-line no-param-reassign
        _state.template = {...template};
    },

    SET_SERVICES_TO_CONNECT(_state, services) {
        _state.servicesToConnect = services;
    },

    SET_ENVIRONMENT_LIST(_state,  environments) {
        // eslint-disable-next-line no-param-reassign
        _state.environmentList = [...environments ];
    },

    SET_GLOBAL_VARS(_state, globalVars) {
        _state.globalVars = {...globalVars};
    },

    SET_TEMPLATES_LIST(_state, templates) {
        // eslint-disable-next-line no-param-reassign
        _state.templateList = [...templates ];
    },

    SET_RESOURCES_LIST(_state, resources) {
        // eslint-disable-next-line no-param-reassign
        _state.resources = [...resources ];
    },

    CHECK_REQUIREMENT(_state,  { requirementTitle }) {
        // eslint-disable-next-line no-param-reassign
        _state.template.requirements.filter(r => r.title === requirementTitle)[0].status = true;
    },

    SET_REQUIREMENT_SELECTED(_state, { requirement, titleKey }) {
        _state.requirementSelected = { requirement, titleKey };
    },

    SET_TEMPLATE_REQUIREMENTS(_state, requirements) {
        _state.template.requirements = requirements;
    },

    SET_CARD_LEVEL_ONE(_state, nodeCard) {
        _state.cardLevelOne = {...nodeCard};
    },

    SET_CARD_LEVEL_TWO(_state, nodeCard) {
        _state.cardLevelTwo = {...nodeCard};
    },

    SET_MAIN_REQUIREMENT(_state, requirement) {
        _state.mainRequirement = {...requirement};
    },

    UPDATE_SUBREQUIREMENT(_state, node) {
        updateSubrequirement(_state.template.requirements, "type", node.type, "requirements", node, null);
    },

    UPDATE_MAIN_INPUTS(_state,  inputs) {
        // eslint-disable-next-line no-param-reassign
        _state.projectInfo.inputs = inputs;
    },

    DELETE_MAIN_REQUIREMENT_NODE(_state, nodeTitle) {
        deleteMainRequirement(_state.template.requirements, "title", nodeTitle);
    },

    DELETE_REQUIREMENT_NODE_DEEP(_state, {nodeTitle, nodeParentTitle}) {
        deleteRequirementDeep(_state.template.requirements, "title", nodeTitle, "requirements", nodeParentTitle, null);
    },
};

const actions = {

    async fetchProjectInfo({ commit }, { projectPath, defaultBranch }) {
        const {errors, data} = await graphqlClient.clients.defaultClient.query({
            query: getProjectInfo,
            errorPolicy: 'all',
            variables: { projectPath, defaultBranch },
        });
        const overview = data.applicationBlueprint.overview;
        const {  id ,description ,fullPath ,name ,webUrl ,image ,livePreview, title, sourceCodeUrl } = overview;
        commit('SET_PROJECT_INFO', { id ,description ,fullPath ,name ,webUrl ,image ,livePreview, title, sourceCodeUrl});
        if(!errors) {
            commit('SET_PROJECT_INFO', overview);
            commit('SET_TEMPLATES_LIST', overview.templates);
            commit('SET_RESOURCES_LIST', overview.resources);
        } else {
            throw new Error(errors[0].message);
        }
        return false;
    },

    async fetchTemplateBySlug({ commit, dispatch }, { projectPath, templateSlug }) {
        const {errors, data} = await graphqlClient.clients.defaultClient.query({
            query: getTemplateBySlug,
            errorPolicy: 'all',
            variables: { projectPath },
        });
        if (errors) {
            throw new Error(errors.map(e => e).join(", "));
        }
        const match = _.find(data.applicationBlueprint.overview.templates, { slug: templateSlug });
        const template = { ...match };
        if(Object.keys(template).length > 0) commit("SET_TEMPLATE_SELECTED", {template});
        if(Object.keys(template).length > 0) dispatch('setResourcesOfTemplate', template.resourceTemplates, {root: true});
        return data.applicationBlueprint;
    },

    async fetchEnvironments({ commit }, { projectPath }) {
        const { errors, data } = await graphqlClient.clients.defaultClient.query({
            query: getEnvironments,
            errorPolicy: 'all',
            variables: { projectPath }
        });
        if ( errors ) {
            throw new Error(errors.map(e => e).join(", "));
        }
        commit('SET_ENVIRONMENT_LIST', data.project.environments.nodes);
        return false;
    },

    async fetchServicesToConnect({ commit }, { projectPath }) {
        const {errors, data} = await graphqlClient.clients.defaultClient.query({
            query: getServicesToConnect,
            errorPolicy: 'all',
            variables: { projectPath },
        });
        if (errors) {
            throw new Error(errors.map(e => e).join(", "));
        }

        const services = [...data.applicationBlueprint.overview.servicesToConnect];
        commit("SET_SERVICES_TO_CONNECT", services);
        return services;

    },

    async createTemplate({ state: _state }, { projectPath }) {
        const template = _.cloneDeep(state.template);
        // eslint-disable-next-line no-underscore-dangle
        delete template.__typename;
        template.resourceTemplates.primary.requirements = deletePropertyFromArray(template.resourceTemplates.primary.requirements);
        const { errors, data } = await graphqlClient.clients.defaultClient.mutate({
            mutation: createTemplate,
            errorPolicy: 'all',
            variables: { projectPath, template }
        });
        if ( errors ) {
            throw new Error(errors.map(e => e.message).join(", "));
        };
        return data;
    },

    // eslint-disable-next-line no-empty-pattern
    async deleteTemplate({ commit, state: _state}, { projectTitle }) {
        const { projectPath }= _state.globalVars;
        const { errors, data } = await graphqlClient.clients.defaultClient.mutate({
            mutation: removeTemplate,
            errorPolicy: 'all',
            variables: { projectPath, title: projectTitle }
        });
        if ( errors ) {
            throw new Error(errors.map(e => e.message).join(", "));
        };
        commit('SET_TEMPLATES_LIST', data.removeTemplate.templates);
        return data.removeTemplate;
    },

    async updateTemplate({ commit, state: _state}, { template, inputs }) {
        delete template.__typename;
        template.requirements = deletePropertyFromArray(template.resourceTemplates.primary.requirements);
        const { projectPath }= _state.globalVars;

        // eslint-disable-next-line no-underscore-dangle
        const mainInputs =  inputs.map((i) => {
            const n = i;
            // eslint-disable-next-line no-underscore-dangle
            delete n.__typename;
            return n;
        });
        const variables = {
            projectPath,
            title: template.title,
            template,
            inputs: mainInputs
        };

        const { errors, data } = await graphqlClient.clients.defaultClient.mutate({
            mutation: updateOverview,
            errorPolicy: 'all',
            variables
        });
        if ( errors ) {
            throw new Error(errors.map(e => e.message).join(", "));
        };
        commit("SET_TEMPLATE_SELECTED", { template });
        return data;
    },

    completeRequirement({ commit }, { requirementTitle } ) {
        commit('CHECK_REQUIREMENT', { requirementTitle });
    },

    setTemplateSelected({ commit }, template) {
        commit("SET_TEMPLATE_SELECTED", { template });
    },

    setRequirementSelected({commit}, { requirement, titleKey}) {
        commit("SET_REQUIREMENT_SELECTED", { requirement, titleKey });
    },

    syncGlobalVars({commit}, globalVars) {
        commit("SET_GLOBAL_VARS", globalVars);
    },

    async updateMainInput({commit}, mainInputs){
        commit("UPDATE_MAIN_INPUTS", mainInputs);
    },

};

const getters = {
    getProjectInfo: _state => _state.projectInfo,
    getEnvironmentsList: _state => _state.environmentList,
    getTemplatesList: _state => _state.templateList,
    getTemplate: _state => _state.template,
    getResources: _state => _state.resources,
    getMainRequirement: _state => _state.mainRequirement,
    getRequirementSelected: _state => _state.requirementSelected,
    getServicesToConnect: _state => _state.servicesToConnect,
};

export default {
    state,
    mutations,
    actions,
    getters
};