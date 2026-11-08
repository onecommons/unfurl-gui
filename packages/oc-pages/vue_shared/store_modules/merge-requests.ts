import type {ActionContext, Module} from '@gitlab/vuex-vue3'
import {listMergeRequests, getOrFetchDefaultBranch} from '../client_utils/projects'

interface State {
    mergeRequests: unknown[] | null
}

const stateFn = (): State => ({
    mergeRequests: []
})

const state = stateFn()

const mutations = {
    setMergeRequests(state: State, mergeRequests: unknown[]) {
        state.mergeRequests = mergeRequests
    }
}

const actions = {
    async fetchMergeRequests({commit, rootGetters}: ActionContext<State, any>) {
        if(window.gon.unfurl_gui) {
            return
        }

        const target = await getOrFetchDefaultBranch(
            encodeURIComponent(rootGetters.getHomeProjectPath)
        )

        const labels = ['unfurl-gui-mr']

        const mergeRequests = await listMergeRequests(
            encodeURIComponent(rootGetters.getHomeProjectPath),
            {target, labels, state: 'opened'}
        )

        commit('setMergeRequests', mergeRequests)
    }
}

const getters = {
    mergeRequests(state: State) { return state.mergeRequests || [] }
}

export default {state, mutations, actions, getters} satisfies Module<State, any>
