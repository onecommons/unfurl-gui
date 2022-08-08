import _ from 'lodash'
import { USER_HOME_PROJECT} from 'oc_vue_shared/util.mjs'
import { fetchUser } from 'oc_vue_shared/client_utils/user'
const DEFAULT_ROUTER_HOOK = (to, from, next) => next()

function isMobileLayout() {
    // gitlab is using this breakpoint a lot
    return window.innerWidth <= 768
}

const state = {
    routerHook: DEFAULT_ROUTER_HOOK,
    isMobileLayout: isMobileLayout(),
    namespace: null,
    user: null
}

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

    setUser(state, user) {
        state.user = user
    }
}

const getters = {
    getRouterHook(state) {return state.routerHook},
    getCurrentNamespace(state, getters) {return state.namespace || getters.getUsername},
    getHomeProjectPath(_, getters)  {return `${getters.getCurrentNamespace}/${USER_HOME_PROJECT}`},
    getUsername() {return window.gon.current_username},
    getUser(state) {
        return state.user
    },
    getFullname() {return window.gon.current_user_fullname},
    isMobileLayout() {return state.isMobileLayout},
    pipelinesPath(_, getters) { return `/${getters.getHomeProjectPath}/-/pipelines` },
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
    }
    /*
    DEPLOY_TAG() {
        return sessionStorage['deploy-tag'] || 'latest'
    }
    */
}

const actions = {
    handleResize({commit, state}) {
        window.addEventListener('resize', _.debounce(
            function(e) {
                const _isMobileLayout = isMobileLayout()
                if(_isMobileLayout != state.isMobileLayout) {
                    commit('setMobileLayout', _isMobileLayout)
                }
            }, 
            30
        ))
    },

    async populateCurrentUser({commit}) {
        commit('setUser', await fetchUser())
    } 
}

export default {state, mutations, getters, actions}
