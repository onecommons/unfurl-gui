
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
    getRouterHook(state) {return state.routerHook}
}


export default {state, mutations, getters}
