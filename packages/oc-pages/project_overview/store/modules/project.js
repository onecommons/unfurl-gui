import _ from 'lodash';
import { __ } from "~/locale";
import axios from '~/lib/utils/axios_utils'
import {lookupNumberOfComments} from 'oc_vue_shared/client_utils/comments'

const state = () => ({
    commentsIssueUrl: null,
    commentsCount: null,
    template: {},
    requirementSelected: {
        titleKey: null,
        requirement: null
    },
    globalVars: {},
    openCloudDeployments: []
});

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
    SET_TEMPLATE_SELECTED(_state,  template) {
        // eslint-disable-next-line no-param-reassign
        _state.template = {...template};
    },

    SET_GLOBAL_VARS(_state, globalVars) {
        _state.globalVars = {...globalVars};
    },

    SET_REQUIREMENT_SELECTED(_state, { requirement, titleKey }) {
        _state.requirementSelected = { requirement, titleKey };
    },

    setOpenCloudDeployments(state, openCloudDeployments) {
        state.openCloudDeployments = openCloudDeployments
    },

    setCommentsIssueUrl(state, url) {
        state.commentsIssueUrl = url
    },

    setCommentsCount(state, count) {
        state.commentsCount = count
    }
};

const actions = {

    async fetchCloudmap( {state, commit, rootGetters} ) {
        const cloudmapURL = state.globalVars.cloudmap

        if(!cloudmapURL) return

        const primaryType = rootGetters.getApplicationBlueprint.primary

        function prepareApp(app, testbed) {
            const item = {...app, testbed: {...testbed}}
            delete item.children
            delete item.testbed.children
            return item
        }

        function* matchingApps(d, parent) {
            if(d.type == 'app') {
                if(d.children.some(c => c.resourceType == primaryType)) {
                    yield prepareApp(d, parent)
                }
            } else {
                for(const child of d.children) {
                    for(const app of matchingApps(child, d)) {
                        yield app
                    }
                }
            }
        }

        const cloudmap = await fetch(cloudmapURL).then(res => res.json())
        const openCloudDeployments = []
        for(const app of matchingApps(cloudmap)) {
            openCloudDeployments.push(app)
        }

        commit('setOpenCloudDeployments', openCloudDeployments)
    },

    async fetchCommentsIssue({ state, commit }) {
        const issues = (await axios.get(`/api/v4/projects/${encodeURIComponent(state.globalVars.projectPath)}/issues?state=opened&label=general+discussion`))?.data


        if(issues && issues.length > 0) {
            const commentsIssueUrl = issues[0].web_url
            commit('setCommentsIssueUrl', commentsIssueUrl)

            commit('setCommentsCount', await lookupNumberOfComments(commentsIssueUrl))
        }
    },

    setTemplateSelected({ commit }, template) {
        commit("SET_TEMPLATE_SELECTED", { template });
    },

    setRequirementSelected({commit}, { requirement, titleKey}) {
        commit("SET_REQUIREMENT_SELECTED", { requirement, titleKey });
    },

    syncGlobalVars({commit}, globalVars) {
        const projectIconEl = document.querySelector('#oc-project-overview-icon img')
        const projectIcon = projectIconEl?.getAttribute('data-src') || projectIconEl?.src
        commit("SET_GLOBAL_VARS", {...globalVars, projectIcon});
    },

    async updateMainInput({commit}, mainInputs){
        commit("UPDATE_MAIN_INPUTS", mainInputs);
    },

};

const getters = {
    getTemplate: _state => _state.template,
    getRequirementSelected: _state => _state.requirementSelected,
    getProjectDescription(state, _a, _b, rootGetters) {
        state.globalVars.projectDescription || rootGetters.getApplicationBlueprint?.description
    },
    yourDeployments(state, getters, _, rootGetters) {
        const result = []
        for(const dict of rootGetters.getDeploymentDictionaries) {
            const deploymentTemplate = Object.values(dict?.DeploymentTemplate)[0]
            if(deploymentTemplate?.projectPath != state.globalVars.projectPath)
                continue

            const obj = {}
            obj.environment = rootGetters.lookupEnvironment(dict._environment)
            // TODO get status from deployment

            let resources = []
            try {
                obj.application = Object.values(dict.ApplicationBlueprint)[0]
            } catch(e) {
                // no obj.application
                console.error(e)
                continue
            }
            if(dict.Deployment) {
                obj.deployment = Object.values(dict.Deployment)[0]
                resources = Object.values(dict.Resource)
                obj.deployment.statuses = [resources.find(resource => resource.name == obj.deployment.primary)]
            } else {
                obj.deployment = Object.values(dict.DeploymentTemplate)[0]
            }

            obj.deployment.projectPath = deploymentTemplate.projectPath

            resources = resources.filter(r => {
                return r.visibility != 'hidden'
            })

            if(resources.length == 0) {
                const context = {...obj}
                result.push({context, ...context})
                continue
            }

            for(const resource of resources) {
                const context = {...obj, resource}
                result.push({context, ...context})
            }

        }
        return result

    },
    openCloudDeployments(state) {
        return state.openCloudDeployments
    },
    commentsIssueUrl(state) {
        return state.commentsIssueUrl
    },
    commentsCount(state) {
        return state.commentsCount
    },
};

export default {
    state,
    mutations,
    actions,
    getters
};
