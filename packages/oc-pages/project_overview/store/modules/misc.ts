import _ from 'lodash'
import type {ActionContext, Module} from '@gitlab/vuex-vue3'
import type {NavigationGuard} from '@gitlab/vue-router-vue3'
import { USER_HOME_PROJECT} from 'oc_vue_shared/util'
import { fetchUser } from 'oc_vue_shared/client_utils/user'
import {fetchProjectInfo} from 'oc_vue_shared/client_utils/projects'
import {createFlash, hideLastFlash, FLASH_TYPES} from 'oc_vue_shared/client_utils/oc-flash'
import {unfurlServerUrlOverride} from 'oc_vue_shared/storage-keys'
import {lookupKey} from 'oc_vue_shared/storage-keys'
import {normpath} from 'oc_vue_shared/lib/normalize'
import {projectPathToHomeRoute} from 'oc_vue_shared/client_utils/dashboard'

const DEFAULT_ROUTER_HOOK: NavigationGuard = (to, from, next) => next()

function isMobileLayout() {
    // gitlab is using this breakpoint a lot
    return window.innerWidth <= 768
}

interface State {
    routerHook: NavigationGuard
    isMobileLayout: boolean
    namespace: string | null
    dashboard: string | null
    dashboardProjectInfo: {name?: string} | null
    user: unknown
    windowWidth: number
    windowHeight: number
    scrollTop: number | undefined
}

// what the getters below read from each other
interface MiscGetters {
    getCurrentNamespace: string | null
    getHomeProjectPath: string | null
    getUsername: string | undefined
    serviceDesk: string
}

type Context = ActionContext<State, any>

const state = (): State => ({
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
    setRouterHook(state: State, hook: NavigationGuard | null | undefined) {
        if(hook) { state.routerHook = hook }
        else { state.routerHook = DEFAULT_ROUTER_HOOK }
    },

    setMobileLayout(state: State, isMobileLayout: boolean) {
        state.isMobileLayout = isMobileLayout
    },

    setCurrentNamespace(state: State, namespace: string | null) {
        state.namespace = namespace
    },

    setDashboardName(state: State, dashboard: string | null) {
        state.dashboard = dashboard
    },

    setUser(state: State, user: unknown) {
        state.user = user
    },

    setDashboardProjectInfo(state: State, projectInfo: State['dashboardProjectInfo']) {
        state.dashboardProjectInfo = projectInfo
    },

    setWindowWidth(state: State, windowWidth: number) {
        state.windowWidth = windowWidth
    },

    setWindowHeight(state: State, windowHeight: number) {
        state.windowHeight = windowHeight
    },

    setScrollTop(state: State, scrollTop: number | undefined) {
        state.scrollTop = scrollTop
    }
}

const getters = {
    getRouterHook(state: State) {return state.routerHook},
    getCurrentNamespace(state: State, getters: MiscGetters) {
        if(window.gon.home_project !== null) return normpath(state.namespace || lookupKey('defaultNamespace') || getters.getUsername)
        return null
    },
    getHomeProjectPath(state: State, getters: MiscGetters)  {
        if(window.gon.home_project !== null) {
            // standalone serves a single local project and names no namespace;
            // the endpoints read an empty path as that project. Qualifying it
            // instead yields the bare USER_HOME_PROJECT, which does not exist.
            if(!getters.getCurrentNamespace) return ''
            return normpath(`${getters.getCurrentNamespace}/${state.dashboard || USER_HOME_PROJECT}`)
        }
        return null
    },
    getHomeProjectName(state: State) {
        if(window.gon.home_project !== null)
        return state.dashboardProjectInfo?.name || 'Dashboard'
        return null
    },
    getUsername() {return window.gon.current_username},
    getUser(state: State) {
        return state.user
    },
    getFullname() {return window.gon.current_user_fullname},
    isMobileLayout(state: State) {return state.isMobileLayout},
    pipelinesPath(_: State, getters: MiscGetters) { return `${projectPathToHomeRoute(getters.getHomeProjectPath)}/-/pipelines` },
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
    windowWidth(state: State) {return state.windowWidth},
    windowHeight(state: State) {return state.windowHeight},
    scrollTop(state: State) {return state.scrollTop},
    serviceDesk() {
        // TODO make this configurable
        return 'onecommons/support'
    }
}

const actions = {
    handleResize({commit, state}: Context) {
        function onResize() {
            const _isMobileLayout = isMobileLayout()
            if(_isMobileLayout != state.isMobileLayout) {
                commit('setMobileLayout', _isMobileLayout)
            }
            commit('setWindowWidth', window.innerWidth)
            commit('setWindowHeight', window.innerHeight)
        }
        function onScroll() {
            commit('setScrollTop', document?.scrollingElement?.scrollTop)
        }
        window.addEventListener('resize', _.throttle(
            function() {
                onResize()
                onScroll()
            },
            30
        ))
        window.addEventListener('scroll', _.throttle( onScroll, 15 ))
    },

    async populateCurrentUser({commit}: Context) {
        commit('setUser', await fetchUser())
    },

    async populateDashboardProject({commit, getters}: Context) {
        const projectInfo = await fetchProjectInfo(encodeURIComponent(getters.getHomeProjectPath))
        commit('setDashboardProjectInfo', projectInfo)
    },

    createFlash({getters}: Context, options: string | {message: string, [key: string]: unknown}) {
        const _options = typeof options == 'string'? {message: options, type: FLASH_TYPES.NOTICE}: options
        return createFlash({
            projectPath: getters.getHomeProjectPath,
            serviceDesk: getters.serviceDesk,
            confidential: true,
            ..._options
        })
    }
}

export default {state, mutations, getters, actions} satisfies Module<State, any>
