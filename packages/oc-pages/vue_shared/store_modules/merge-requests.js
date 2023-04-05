import {listMergeRequests} from '../client_utils/projects'
const stateFn = () => ({
    mergeRequests: []
})

const state = stateFn()

const mutations = {
    setMergeRequests(state, mergeRequests) {
        state.mergeRequests = mergeRequests
    }
}

const actions = {
    async fetchMergeRequests({commit, rootGetters}) {
        const target = 'main'
        const labels = ['unfurl-gui-mr']

        const mergeRequests = await listMergeRequests(
            encodeURIComponent(rootGetters.getHomeProjectPath),
            {target, labels, state: 'opened'}
        )

        commit('setMergeRequests', mergeRequests)
    }
}

const getters = {
    mergeRequests(state) { return state.mergeRequests || [] }
}

export default {state, mutations, actions, getters}
