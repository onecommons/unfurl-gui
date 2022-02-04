
import { USER_HOME_PROJECT} from '../../../vue_shared/util.mjs'
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
    getHomeProjectPath(_, getters)  {return `${getters.getUsername}/${USER_HOME_PROJECT}`},
    getUsername() {return window.gon.current_username},
    getFullname() {return window.gon.current_user_fullname}
}


export default {state, mutations, getters}
