import _ from 'lodash'
import { USER_HOME_PROJECT} from 'oc_vue_shared/util.mjs'
import { fetchUser } from 'oc_vue_shared/client_utils/user'
import {fetchProjectInfo} from 'oc_vue_shared/client_utils/projects'
import {createFlash, hideLastFlash, FLASH_TYPES} from 'oc_vue_shared/client_utils/oc-flash'
import {unfurlServerUrlOverride} from 'oc_vue_shared/storage-keys'

const DEFAULT_ROUTER_HOOK = (to, from, next) => next()

function isMobileLayout() {
    // gitlab is using this breakpoint a lot
    return window.innerWidth <= 768
}

const state = () => ({
    routerHook: DEFAULT_ROUTER_HOOK,
    isMobileLayout: isMobileLayout(),
    namespace: null,
    dashboard: null,
    dashboardProjectInfo: null,
    user: null,
    windowWidth: window.innerWidth
})

const mutations = {
    setRouterHook(state, hook) {
        if(hook) { state.routerHook = hook }
        else { state.routerHook = DEFAULT_ROUTER_HOOK }
    },

    setMobileLayout(state, isMobileLayout) {
        state.isMobileLayout = isMobileLayout
    },

    setCurrentNamespace(state, namespace) {
        state.namespace = namespace
    },

    setDashboardName(state, dashboard) {
        state.dashboard = dashboard
    },

    setUser(state, user) {
        state.user = user
    },

    setDashboardProjectInfo(state, projectInfo) {
        state.dashboardProjectInfo = projectInfo
    },

    setWindowWidth(state, windowWidth) {
        state.windowWidth = windowWidth
    }
}

const getters = {
    getRouterHook(state) {return state.routerHook},
    getCurrentNamespace(state, getters) {return state.namespace || getters.getUsername},
    getHomeProjectPath(state, getters)  {return `${getters.getCurrentNamespace}/${state.dashboard || USER_HOME_PROJECT}`},
    getHomeProjectName(state) { return state.dashboardProjectInfo?.name || 'Dashboard' },
    getUsername() {return window.gon.current_username},
    getUser(state) {
        return state.user
    },
    getFullname() {return window.gon.current_user_fullname},
    isMobileLayout() {return state.isMobileLayout},
    pipelinesPath(_, getters) { return `/${getters.getHomeProjectPath}/-/pipelines` },
    //deployTriggerPath(_, getters) { return `/${getters.getHomeProjectPath}/-/deployments/new` },
    UNFURL_MOCK_DEPLOY() {
        if((/(&|\?)(unfurl(-|_))?mock(_|-)deploy/i).test(window.location.search)) return true
        let key = Object.keys(sessionStorage).find(key => (/(unfurl(-|_))?mock(_|-)deploy/i).test(key))
        if(key && sessionStorage[key]) return true
        return false
    },
    REVEAL_HIDDEN_TEMPLATES() {
        return !!Object.keys(sessionStorage).find(key => key == 'reveal-hidden-templates')
    },
    UNFURL_TRACE() {
        return !!Object.keys(sessionStorage).find(key => key == 'unfurl-trace')
    },
    DEPLOY_IMAGE() {
        return sessionStorage['deploy-image'] || 'onecommons/unfurl:latest'
    },
    registryURL() {
        return sessionStorage['registry-url']
    },
    windowWidth(state) {return state.windowWidth},
    serviceDesk() {
        // TODO make this configurable
        return 'onecommons/support'
    }
}

const actions = {
    handleResize({commit, state}) {
        window.addEventListener('resize', _.throttle(
            function(e) {
                const _isMobileLayout = isMobileLayout()
                if(_isMobileLayout != state.isMobileLayout) {
                    commit('setMobileLayout', _isMobileLayout)
                }
                commit('setWindowWidth', window.innerWidth)
            }, 
            30
        ))
    },

    async populateCurrentUser({commit}) {
        commit('setUser', await fetchUser())
    },

    async populateDashboardProject({commit, getters}) {
        const projectInfo = await fetchProjectInfo(encodeURIComponent(getters.getHomeProjectPath))
        commit('setDashboardProjectInfo', projectInfo)
    },

    createFlash({getters}, options) {
        return createFlash({
            projectPath: getters.getHomeProjectPath,
            serviceDesk: getters.serviceDesk,
            confidential: true,
            ...options
        })
    }
}

export default {state, mutations, getters, actions}
