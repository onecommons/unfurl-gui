import { templateElement } from "@babel/types";
import _ from 'lodash';
import { __ } from "~/locale";
import graphqlClient from '../../graphql';
import gql from 'graphql-tag'
import createTemplate from '../../graphql/mutations/create_template.mutation.graphql';
import getEnvironments from '../../graphql/queries/get_environments.query.graphql';
import getProjectInfo from '../../graphql/queries/get_project_info.query.graphql';
import getTemplateBySlug from '../../graphql/queries/get_template_by_slug.query.graphql';
import getServicesToConnect from '../../graphql/queries/get_services_to_connect.query.graphql';
import UpdateDeploymentObject from '../../graphql/mutations/update_deployment_object.graphql'
import {createResourceTemplate} from './deployment_template_updates.js'
import removeTemplate from '../../graphql/mutations/remove_template.mutation.graphql';
import {slugify} from '../../../vue_shared/util'


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

    async fetchProjectInfo({ commit }, { projectPath, defaultBranch }) {
        // TODO we need to change this query if we're using it for RESOURCES_LIST (aka) resourceTemplates, because it doesn't seem to pick a specific blueprint by slug
        const {errors, data} = await graphqlClient.clients.defaultClient.query({
            query: getProjectInfo,
            errorPolicy: 'all',
            fetchPolicy: 'network-only',
            variables: { projectPath, defaultBranch },
        });
        const overview = data.unfurlRoot.applicationBlueprint.overview;
        // NOTE we don't have title,image
        const projectInfo = {...data.unfurlRoot.applicationBlueprint.overview, ...data.unfurlRoot.applicationBlueprint, fullPath: projectPath}
        //const {  id ,description ,fullPath ,name ,webUrl ,image ,livePreview, title, sourceCodeUrl } = overview;
        //commit('SET_PROJECT_INFO', { id ,description ,fullPath ,name ,webUrl ,image ,livePreview, title, sourceCodeUrl});
        commit('SET_PROJECT_INFO', projectInfo)
        if(!errors) {
            // NOTE I'm doing this in template_resources
            //commit('SET_PROJECT_INFO', overview);

            commit('SET_TEMPLATES_LIST', data.unfurlRoot.applicationBlueprint.deploymentTemplates);

            // NOTE this is strange because it populates something used by another view
            // It would be a good idea to move into the template_resources store when refactoring
            commit('SET_RESOURCES_LIST', data.unfurlRoot.applicationBlueprint.deploymentTemplates[0].resourceTemplates);
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
        const template = { ...data.unfurlRoot.applicationBlueprint.overview.templates[0] };
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

    /*
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
    */

    // eslint-disable-next-line no-empty-pattern
    /*
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
    */

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
                typename: 'DeploymentTemplate'
            }

        })

        throwErrorsFromDeploymentUpdateResponse(errors, data)

    },
    // TODO remove this
    async editResourcesTemplateInDependent({state}, {dependentName, transformList}) {
        const queryResponse = await graphqlClient.clients.defaultClient.query({
            query: gql`
            query getResourceTemplateRaw($fullPath: ID!, $name: String) {
                resourceTemplateRaw(fullPath: $fullPath, name: $name) @client
            }
            `,
            variables: { fullPath: state.globalVars.projectPath, name: dependentName },
            errorPolicy: 'all'
        })

        throwErrorsFromDeploymentUpdateResponse(queryResponse)

        const {resourceTemplateRaw} = queryResponse.data


        resourceTemplateRaw.dependencies = transformList(resourceTemplateRaw.dependencies)
        resourceTemplateRaw.__typename = 'ResourceTemplate'
        const patch = { [resourceTemplateRaw.name]: resourceTemplateRaw }
        const {errors, data} = await graphqlClient.clients.defaultClient.mutate({
            mutation: UpdateDeploymentObject,
            variables: {
                patch, 
                fullPath: state.globalVars.projectPath,
                typename: 'ResourceTemplate'
            }
        })
        throwErrorsFromDeploymentUpdateResponse(errors, data)
    },
    // TODO remove this
    async appendResourceTemplateInDependent ({dispatch}, {templateName, dependentName, dependentRequirement}) {
        function transformList(list) {
            return list.map(req => {
                if(req.name == dependentRequirement) {
                    req.match = templateName
                }
                return req
            })
        }
        return dispatch('editResourcesTemplateInDependent', {dependentName, transformList})
    },
    // TODO remove this
    async deleteResourceTemplateInDependent ({dispatch}, {dependentName, dependentRequirement}) {
        function transformList(list) {
            return list.map(req => {
                if(req.name == dependentRequirement) {
                    req.match = null
                }
                return req
            })
        }
        return dispatch('editResourcesTemplateInDependent', {dependentName, transformList})

    },
    // TODO remove this
    async editResourcesInDeploymentTemplate({state}, {deploymentTemplateSlug, transformList}) {
        const queryResponse = await graphqlClient.clients.defaultClient.query({
            query: gql`
            query getDeploymentTemplateRaw($fullPath: ID!, $name: String) {
                deploymentTemplateRaw(fullPath: $fullPath, name: $name) @client
            }
            `,
            variables: { fullPath: state.globalVars.projectPath, name: deploymentTemplateSlug }
        })

        const {deploymentTemplateRaw} = queryResponse.data


        deploymentTemplateRaw.resourceTemplates = transformList(deploymentTemplateRaw.resourceTemplates)
        deploymentTemplateRaw.__typename = 'DeploymentTemplate'
        const patch = { [deploymentTemplateRaw.slug]: deploymentTemplateRaw }
        const {errors, data} = await graphqlClient.clients.defaultClient.mutate({
            mutation: UpdateDeploymentObject,
            variables: {
                patch, 
                fullPath: state.globalVars.projectPath,
                typename: 'DeploymentTemplate'
            }
        })
    },

    // TODO remove this
    appendResourceTemplateInDT({dispatch}, {templateName, deploymentTemplateSlug}) {
        function transformList(list) {
            const filtered = list.filter(li => li != templateName)
            filtered.push(templateName)
            return filtered
        }
        return dispatch('editResourcesInDeploymentTemplate', {transformList, deploymentTemplateSlug})
    },

    // TODO remove this
    deleteResourceTemplateInDT({dispatch}, {templateName, deploymentTemplateSlug}) {
        function transformList(list) {
            const filtered = list.filter(li => li != templateName)
            return filtered
        }
        return dispatch('editResourcesInDeploymentTemplate', {transformList, deploymentTemplateSlug})
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
                typename: 'ApplicationBlueprint'
            }
        })
        throwErrorsFromDeploymentUpdateResponse(errors, data)
    },

    // TODO remove this
    appendDeploymentTemplateInBlueprint({dispatch}, templateName) {
        function transformList(list) {
            const filtered = list.filter(li => li != templateName)
            filtered.push(templateName)
            return filtered
        }
        return dispatch('editDeploymentTemplatesInBlueprint', {transformList})
    },

    // TODO remove this
    deleteDeploymentTemplateInBlueprint({dispatch}, templateName) {
        function transformList(list) {
            const filtered = list.filter(li => li != templateName)
            return filtered
        }
        return dispatch('editDeploymentTemplatesInBlueprint', {transformList})
    },

    // TODO remove this
    async deleteResourceTemplate({dispatch}, {templateName, deploymentTemplateSlug}) {
        if(deploymentTemplateSlug) {
            await dispatch('deleteResourceTemplateInDT', {templateName, deploymentTemplateSlug})
        }
        const {errors, data} = await graphqlClient.clients.defaultClient.mutate({
            mutation: UpdateResourceTemplate,
            variables: {
                patch: { [templateName]: null },
                fullPath: state.globalVars.projectPath,
                typename: 'ResourceTemplate'
            },
            errorPolicy: 'all'
        })

        throwErrorsFromDeploymentUpdateResponse(errors, data)
    },

    // TODO remove this
    async createResourceTemplate({commit, dispatch, getters, rootState, state}, {type, name, title, description, deploymentTemplateSlug, dependentName, dependentRequirement}) {
        //deployment_template_updates.js
        commit('pushPreparedMutation', createResourceTemplate({type, name, title, description, deploymentTemplateSlug, dependentName, dependentRequirement}))
        await dispatch('commitPreparedMutations')

        /*
        if(deploymentTemplateSlug) {
            await dispatch('appendResourceTemplateInDT', {templateName: name, deploymentTemplateSlug})
        }

        if(dependentName && dependentRequirement) {
            await dispatch('appendResourceTemplateInDependent', {templateName: name, dependentName, dependentRequirement})
        }

        const resourceType = typeof(type) == 'string'? getters.getAvailableResourceTypes.find(rt => rt.name == type): type
        const properties = resourceType.properties
        const dependencies = resourceType.requirements.map(req => ({
            constraint: req,
            match: null,
            target: null,
            name: req.name,
            __typename: 'Dependency'
        }))
        const patch = {
            [name]: {
                type: typeof(type) == 'string'? type: type.name,
                name,
                title,
                description,
                __typename: "ResourceTemplate",
                properties,
                dependencies
            }
        }

        const {errors, data} = await graphqlClient.clients.defaultClient.mutate({
            mutation: UpdateDeploymentObject,
            variables: {
                patch, 
                fullPath: state.globalVars.projectPath,
                typename: 'ResourceTemplate'
            }
        })

        throwErrorsFromDeploymentUpdateResponse(errors, data)
        */

    },

    // TODO remove this
    async createDeploymentTemplate({commit, dispatch, getters, rootState, state}, {primary, name, title, slug, description}) {
        const type = getters.getProjectInfo.primary.name

        const _slug = slug || name
        const _name = name || slug
        await dispatch('createResourceTemplate', {type, name: slugify(primary), title: primary, description})
        await dispatch('appendDeploymentTemplateInBlueprint', _name)

        const patch = {
            [_slug]: {
                primary: slugify(primary),
                name: _name,
                blueprint: getters.getProjectInfo.name,
                slug: _slug,
                description,
                title,
                __typename: "DeploymentTemplate",
                resourceTemplates: [slugify(primary)],
            }
        }

        const {errors, data} = await graphqlClient.clients.defaultClient.mutate({
            mutation: UpdateDeploymentObject,
            variables: {
                patch, 
                fullPath: state.globalVars.projectPath,
                typename: 'DeploymentTemplate'
            }
        })

        throwErrorsFromDeploymentUpdateResponse(errors, data)
    }
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
