
const DEFAULT_ROUTER_HOOK = (to, from, next) => next()

const state = {
    routerHook: DEFAULT_ROUTER_HOOK
}


const mutations = {
    setRouterHook(state, hook) {
        if(hook) { state.routerHook = hook }
        else { state.routerHook = DEFAULT_ROUTER_HOOK }
    }

}

const getters = {
    getRouterHook(state) {return state.routerHook},
    getUsername(state) {return window.gon.current_username},
    getFullname(state) {return window.gon.current_user_fullname}
}


export default {state, mutations, getters}
