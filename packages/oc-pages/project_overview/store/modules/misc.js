import _ from 'lodash'
import { USER_HOME_PROJECT} from 'oc_vue_shared/util'
import { fetchUser } from 'oc_vue_shared/client_utils/user'
import {fetchProjectInfo} from 'oc_vue_shared/client_utils/projects'
import {createFlash, hideLastFlash, FLASH_TYPES} from 'oc_vue_shared/client_utils/oc-flash'
import {unfurlServerUrlOverride} from 'oc_vue_shared/storage-keys'
import {lookupKey} from 'oc_vue_shared/storage-keys'
import {normpath} from 'oc_vue_shared/lib/normalize'

const DEFAULT_ROUTER_HOOK = (to, from, next) => next()

function isMobileLayout() {
    // gitlab is using this breakpoint a lot
    return window.innerWidth <= 768
}

const state = () => ({
    routerHook: DEFAULT_ROUTER_HOOK,
    isMobileLayout: isMobileLayout(),
    namespace: window.gon.home_project?.split('/')?.shift() || null,
    dashboard: window.gon.home_project?.split('/')?.slice(1)?.join('/') || null,
    dashboardProjectInfo: null,
    user: null,
    windowWidth: window.innerWidth,
    windowHeight: window.innerHeight,
    scrollTop: document?.scrollingElement?.scrollTop
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
    },

    setWindowHeight(state, windowHeight) {
        state.windowHeight = windowHeight
    },

    setScrollTop(state, scrollTop) {
        state.scrollTop = scrollTop
    }
}

const getters = {
    getRouterHook(state) {return state.routerHook},
    getCurrentNamespace(state, getters) {
        if(window.gon.home_project !== null) return normpath(state.namespace || lookupKey('defaultNamespace') || getters.getUsername)
        return null
    },
    getHomeProjectPath(state, getters)  {
        if(window.gon.home_project !== null) return normpath(`${getters.getCurrentNamespace}/${state.dashboard || USER_HOME_PROJECT}`)
        return null
    },
    getHomeProjectName(state) {
        if(window.gon.home_project !== null) 
        return state.dashboardProjectInfo?.name || 'Dashboard'
        return null
    },
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
    windowHeight(state) {return state.windowHeight},
    scrollTop(state) {return state.scrollTop},
    serviceDesk() {
        // TODO make this configurable
        return 'onecommons/support'
    }
}

const actions = {
    handleResize({commit, state}) {
        function onResize(e) {
            const _isMobileLayout = isMobileLayout()
            if(_isMobileLayout != state.isMobileLayout) {
                commit('setMobileLayout', _isMobileLayout)
            }
            commit('setWindowWidth', window.innerWidth)
            commit('setWindowHeight', window.innerHeight)
        }
        function onScroll(e) {
            commit('setScrollTop', document?.scrollingElement?.scrollTop)
        }
        window.addEventListener('resize', _.throttle(
            function(e) {
                onResize(e)
                onScroll(e)
            },
            30
        ))
        window.addEventListener('scroll', _.throttle( onScroll, 15 ))
    },

    async populateCurrentUser({commit}) {
        commit('setUser', await fetchUser())
    },

    async populateDashboardProject({commit, getters}) {
        const projectInfo = await fetchProjectInfo(encodeURIComponent(getters.getHomeProjectPath))
        commit('setDashboardProjectInfo', projectInfo)
    },

    createFlash({getters}, options) {
        let _options = options
        if(typeof _options == 'string') {
            _options = {message: options, type: FLASH_TYPES.NOTICE}
        }
        return createFlash({
            projectPath: getters.getHomeProjectPath,
            serviceDesk: getters.serviceDesk,
            confidential: true,
            ..._options
        })
    }
}

export default {state, mutations, getters, actions}
