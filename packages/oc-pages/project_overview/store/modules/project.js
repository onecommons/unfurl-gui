import { templateElement } from "@babel/types";
import _ from 'lodash';
import { __ } from "~/locale";
import graphqlClient from '../../graphql';
import gql from 'graphql-tag'
import getProjectInfo from '../../graphql/queries/get_project_info.query.graphql';
import UpdateDeploymentObject from '../../graphql/mutations/update_deployment_object.graphql'
import {userDefaultPath} from '../../../vue_shared/util.mjs'


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

function throwErrorsFromDeploymentUpdateResponse(...args) {
    if(!args.length) return
    let errors
    let errorArgIndex = args.length
    let data
    if(Array.isArray(args[0])) {
        errors = args[0]
        errorArgIndex = 0
    } else if (args.length > 1 && Array.isArray(args[1])) {
        errors = args[1]
        errorArgIndex = 1
    }

    if (errors?.length) throw new Error(errors)
    data = args[args.length - errorArgIndex]
    if(data?.errors?.length) throw new Error(data.errors)
    if(data?.data?.errors?.length) throw new Error(data.data.errors)
}

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

    async fetchProjectInfo({ commit, dispatch }, { projectPath, defaultBranch }) {
        const {errors, data} = await graphqlClient.clients.defaultClient.query({
            query: getProjectInfo,
            errorPolicy: 'all',
            fetchPolicy: 'network-only',
            variables: { projectPath, defaultBranch },
        });
        // NOTE we don't have title,image

        async function fetchProjectPermissions(projectPath) {
            const query = gql`
            query userPermissions($projectPath: ID!) {
                project(fullPath: $projectPath) {
                    userPermissions {
                        pushCode
                        __typename
                    }
                }
            }`

            const result = await graphqlClient.defaultClient.query({
                query,
                variables: {projectPath},
                errorPolicy: 'all'
            })

            return result?.data?.project?.userPermissions?.pushCode ?? false
        }

        const hasEditPermissions = await fetchProjectPermissions(projectPath)


        const projectInfo = {...data.applicationBlueprintProject.applicationBlueprint, fullPath: projectPath, hasEditPermissions}
        commit('SET_PROJECT_INFO', projectInfo)
        if(!errors) {
            commit('SET_TEMPLATES_LIST', data.applicationBlueprintProject.applicationBlueprint.deploymentTemplates);
        } else {
            throw new Error(errors[0].message);
        }
        return false;
        dispatch('countDeployments', {projectPath})
    },

    countDeployments({rootGetters, commit}, {projectPath}) {
        /*
         * TODO figure out how to count deployments (also if it should be global or not)
        for(const deployment of rootGetters.getDeploymentDictionaries) {
            if(deployment.ApplicationBlueprint[projectPath]) {
            }
        }
        */
    },

    async fetchServicesToConnect({ commit }, { projectPath }) {
        //const {errors, data} = await graphqlClient.clients.defaultClient.query({
        /*
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

        */
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

    // TODO remove this
    async deleteDeploymentTemplate({commit, dispatch, getters, rootState, state}, slug) {
        dispatch('deleteDeploymentTemplateInBlueprint', slug)

        const { errors, data } = await graphqlClient.clients.defaultClient.mutate({
            mutation: UpdateDeploymentObject,
            variables: {
                patch: { [slug]: null },
                fullPath: state.globalVars.projectPath,
                typename: 'DeploymentTemplate',
                path: userDefaultPath()
            }

        })

        throwErrorsFromDeploymentUpdateResponse(errors, data)

    },
    // TODO remove this
    async editDeploymentTemplatesInBlueprint({state}, {transformList}) {
        const queryResponse = await graphqlClient.clients.defaultClient.query({
            query: gql`
            query getBlueprintRaw($fullPath: ID!, $name: String) {
            blueprintRaw(fullPath: $fullPath, name: $name) @client 
        }
            `,
            variables: { fullPath: state.globalVars.projectPath }
        })

        throwErrorsFromDeploymentUpdateResponse(queryResponse)
        const {blueprintRaw} = queryResponse.data

        blueprintRaw.deploymentTemplates = transformList(blueprintRaw.deploymentTemplates)
        blueprintRaw.__typename = 'ApplicationBlueprint'
        const patch = { [blueprintRaw.name]: blueprintRaw }
        const {errors, data} = await graphqlClient.clients.defaultClient.mutate({
            mutation: UpdateDeploymentObject,
            variables: {
                patch, 
                fullPath: state.globalVars.projectPath,
                typename: 'ApplicationBlueprint',
                path: userDefaultPath()
            }
        })
        throwErrorsFromDeploymentUpdateResponse(errors, data)
    },

    // TODO remove this
    deleteDeploymentTemplateInBlueprint({dispatch}, templateName) {
        function transformList(list) {
            const filtered = list.filter(li => li != templateName)
            return filtered
        }
        return dispatch('editDeploymentTemplatesInBlueprint', {transformList})
    },

};

const getters = {
    getProjectInfo: _state => _state.projectInfo,
    //getEnvironmentsList: _state => _state.environmentList,
    getTemplatesList: _state => _state.templateList,
    getTemplate: _state => _state.template,
    getResourceTemplates: _state => _state.resourceTemplates,
    getMainRequirement: _state => _state.mainRequirement,
    getRequirementSelected: _state => _state.requirementSelected,
    getServicesToConnect: _state => _state.servicesToConnect,
    hasEditPermissions: _state => _state.projectInfo.hasEditPermissions,
};

export default {
    state,
    mutations,
    actions,
    getters
};
