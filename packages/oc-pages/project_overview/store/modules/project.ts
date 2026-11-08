import type {ActionContext, Module} from '@gitlab/vuex-vue3'
import axios from '~/lib/utils/axios_utils'
import {lookupNumberOfComments} from 'oc_vue_shared/client_utils/comments'

// The unfurl export JSON; typed loosely until the payload types exist.
type Json = Record<string, any>

// A node of the cloudmap tree: groups of apps, apps of resources.
interface CloudmapNode {
    type?: string
    resourceType?: string
    children?: CloudmapNode[]
    [key: string]: unknown
}

// An app from the cloudmap, with the group (testbed) it sits in.
type OpenCloudDeployment = Omit<CloudmapNode, 'children'> & {testbed: Omit<CloudmapNode, 'children'>}

interface State {
    commentsIssueUrl: string | null
    commentsCount: number | null
    // never set: nothing commits it, so getTemplate is always {}
    template: Json
    requirementSelected: {titleKey: string | null, requirement: unknown}
    globalVars: Json
    openCloudDeployments: OpenCloudDeployment[]
}

type Context = ActionContext<State, any>

const state = (): State => ({
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

const mutations = {
    SET_GLOBAL_VARS(_state: State, globalVars: Json) {
        _state.globalVars = {...globalVars};
    },

    SET_REQUIREMENT_SELECTED(_state: State, { requirement, titleKey }: State['requirementSelected']) {
        _state.requirementSelected = { requirement, titleKey };
    },

    setOpenCloudDeployments(state: State, openCloudDeployments: OpenCloudDeployment[]) {
        state.openCloudDeployments = openCloudDeployments
    },

    setCommentsIssueUrl(state: State, url: string) {
        state.commentsIssueUrl = url
    },

    setCommentsCount(state: State, count: number) {
        state.commentsCount = count
    }
};

const actions = {

    async fetchCloudmap( {state, commit, rootGetters}: Context ) {
        const cloudmapURL = state.globalVars.cloudmap

        if(!cloudmapURL) return

        const primaryType = rootGetters.getApplicationBlueprint.primary

        function prepareApp(app: CloudmapNode, testbed: CloudmapNode | undefined): OpenCloudDeployment {
            const item = {...app, testbed: {...testbed}}
            delete item.children
            delete item.testbed.children
            return item
        }

        function* matchingApps(d: CloudmapNode, parent?: CloudmapNode): Generator<OpenCloudDeployment> {
            if(d.type == 'app') {
                if(d.children!.some(c => c.resourceType == primaryType)) {
                    yield prepareApp(d, parent)
                }
            } else {
                for(const child of d.children || []) {
                    for(const app of matchingApps(child, d)) {
                        yield app
                    }
                }
            }
        }

        const cloudmap: CloudmapNode = await fetch(cloudmapURL).then(res => res.json())
        const openCloudDeployments: OpenCloudDeployment[] = []
        for(const app of matchingApps(cloudmap)) {
            openCloudDeployments.push(app)
        }

        commit('setOpenCloudDeployments', openCloudDeployments)
    },

    async fetchCommentsIssue({ state, commit }: Context) {
        let issues: {web_url: string}[] | undefined

        // #!if !standalone
        issues = (await axios.get(`/api/v4/projects/${encodeURIComponent(state.globalVars.projectPath)}/issues?state=opened&label=general+discussion`))?.data
        // #!endif

        if(issues && issues.length > 0) {
            const commentsIssueUrl = issues[0].web_url
            commit('setCommentsIssueUrl', commentsIssueUrl)

            commit('setCommentsCount', await lookupNumberOfComments(commentsIssueUrl))
        }
    },

    setRequirementSelected({commit}: Context, { requirement, titleKey}: State['requirementSelected']) {
        commit("SET_REQUIREMENT_SELECTED", { requirement, titleKey });
    },

    syncGlobalVars({commit}: Context, globalVars: Json) {
        const projectIconEl = document.querySelector<HTMLImageElement>('#oc-project-overview-icon img')
        const projectIcon = projectIconEl?.getAttribute('data-src') || projectIconEl?.src
        commit("SET_GLOBAL_VARS", {...globalVars, projectIcon});
    },

};

// One row of a blueprint's deployments table: a resource, or a deployment with none.
interface DeploymentRow {
    environment?: Json
    application?: Json
    deployment?: Json
    resource?: Json
    context: Omit<DeploymentRow, 'context'>
}

const getters = {
    getTemplate: (_state: State) => _state.template,
    getRequirementSelected: (_state: State) => _state.requirementSelected,
    getGlobalVars: (state: State) => state.globalVars,
    getProjectDescription(state: State, _a: unknown, _b: unknown, rootGetters: any) {
        return state.globalVars.projectDescription || rootGetters.getApplicationBlueprint?.description
    },
    yourDeployments(state: State, _getters: unknown, _: unknown, rootGetters: any) {
        const result: DeploymentRow[] = []
        for(const dict of rootGetters.getDeploymentDictionaries as Json[]) {
            let deploymentTemplate: Json | undefined
            try {
                deploymentTemplate = Object.values(dict?.DeploymentTemplate)[0] as Json
            } catch(e) {continue}
            if(deploymentTemplate?.projectPath != state.globalVars.projectPath)
                continue

            const obj: Omit<DeploymentRow, 'context'> = {}
            obj.environment = rootGetters.lookupEnvironment(dict._environment)
            // TODO get status from deployment

            let resources: Json[] = []
            try {
                obj.application = Object.values(dict.ApplicationBlueprint)[0] as Json
            } catch(e) {
                // no obj.application
                console.error(e)
                continue
            }

            if(dict.Deployment && dict.Resource[(Object.values(dict.Deployment)[0] as Json).primary]) {
                const deployment = Object.values(dict.Deployment)[0] as Json
                resources = Object.values(dict.Resource)
                obj.deployment = {
                    ...deployment,
                    statuses: [resources.find(resource => resource.name == deployment.primary)],
                }
            } else {
                obj.deployment = {...Object.values(dict.DeploymentTemplate)[0] as Json}
            }

            obj.deployment.projectPath = deploymentTemplate!.projectPath

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
    openCloudDeployments(state: State) {
        return state.openCloudDeployments
    },
    commentsIssueUrl(state: State) {
        return state.commentsIssueUrl
    },
    commentsCount(state: State) {
        return state.commentsCount
    },
};

export default {
    state,
    mutations,
    actions,
    getters
} satisfies Module<State, any>;
