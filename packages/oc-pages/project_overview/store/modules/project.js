import { templateElement } from "@babel/types";
import _ from 'lodash';
import { __ } from "~/locale";
import graphqlClient from '../../graphql';
import createTemplate from '../../graphql/mutations/create_template.mutation.graphql';
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
    resourceTemplates: [],
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

    SET_TEMPLATE_SELECTED(_state,  template) {
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

    SET_RESOURCES_LIST(_state, resourceTemplates) {
        // eslint-disable-next-line no-param-reassign
        _state.resourceTemplates = [...resourceTemplates ];
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
        // TODO we need to change this query if we're using it for RESOURCES_LIST (aka) resourceTemplates, because it doesn't seem to pick a specific blueprint by slug
        const {errors, data} = await graphqlClient.clients.defaultClient.query({
            query: getProjectInfo,
            errorPolicy: 'all',
            variables: { projectPath, defaultBranch },
        });
        const overview = data.newApplicationBlueprint.overview;
        // NOTE we don't have title,image
        const projectInfo = {...data.newApplicationBlueprint.overview, ...data.newApplicationBlueprint, fullPath: projectPath}
        //const {  id ,description ,fullPath ,name ,webUrl ,image ,livePreview, title, sourceCodeUrl } = overview;
        //commit('SET_PROJECT_INFO', { id ,description ,fullPath ,name ,webUrl ,image ,livePreview, title, sourceCodeUrl});
        commit('SET_PROJECT_INFO', projectInfo)
        if(!errors) {
            // NOTE I'm doing this in template_resources
            //commit('SET_PROJECT_INFO', overview);

            commit('SET_TEMPLATES_LIST', data.newApplicationBlueprint.deploymentTemplates);

            // NOTE this is strange because it populates something used by another view
            // It would be a good idea to move into the template_resources store when refactoring
            commit('SET_RESOURCES_LIST', data.newApplicationBlueprint.deploymentTemplates[0].resourceTemplates);
        } else {
            throw new Error(errors[0].message);
        }
        return false;
    },

    async fetchTemplateBySlug({ commit, dispatch }, { projectPath, templateSlug }) {
        const {errors, data} = await graphqlClient.clients.defaultClient.query({
            query: getTemplateBySlug,
            errorPolicy: 'all',
            variables: { projectPath, templateSlug },
        });
        if (errors) {
            throw new Error(errors.map(e => e).join(", "));
        }
        //const match = _.find(data.applicationBlueprint.overview.templates, { slug: templateSlug });
        const template = { ...data.newApplicationBlueprint.overview.templates[0] };
        if(Object.keys(template).length > 0) commit("SET_TEMPLATE_SELECTED", template);
        //if(Object.keys(template).length > 0) dispatch('setResourcesOfTemplate', template, {root: true});
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
        //const {errors, data} = await graphqlClient.clients.defaultClient.query({
        const {errors, data} = await graphqlClient.clients.defaultClient.query({
            query: getServicesToConnect, //TODO don't query entire blueprint here
            errorPolicy: 'all',
            //variables: { projectPath },
        });
        if (errors) {
            throw new Error(errors.map(e => e).join(", "));
        }

        //const services = [...data.applicationBlueprint.overview.servicesToConnect];
        const services = data.servicesToConnect
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

  completeRequirement({ commit }, { requirementTitle }) {
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
    getResourceTemplates: _state => _state.resourceTemplates,
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
