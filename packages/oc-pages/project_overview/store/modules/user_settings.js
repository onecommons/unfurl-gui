import Vue from 'vue'

const LOCALSTORAGE_KEY = 'us'

const state = {
  lastUsedEnvironmentList: [], // { cloud, environmentName }
}

const mutations = {
  initUserSettings(state, { username }) {
    Object.assign(state, JSON.parse(localStorage.getItem(`${LOCALSTORAGE_KEY}-${username}`)))
  },
  setLastUsedEnvironmentList(state, { updatedLastUsedEnvironmentList }) {
    state.lastUsedEnvironmentList = updatedLastUsedEnvironmentList
  },
  // not meant to be used publicly
  _applyUserSetting(state, {key, value}) {
    Vue.set(state, key, value)
  }
}

const actions = {
  applyUserSetting({commit, dispatch, rootGetters}, props) {
    commit('_applyUserSetting', props)
    dispatch('save', {username: rootGetters.getUsername})
  },
  updateLastUsedEnvironment({ commit, dispatch, state }, { lastUsedEnvironment, username }) {
    let foundSameCloud = false

    const updatedLastUsedEnvironmentList = state.lastUsedEnvironmentList.map((env) => {
      if (env.cloud === lastUsedEnvironment.cloud) {  // found the same cloud, update the lastUsedEnvironment
        foundSameCloud = true
        return {
          ...env,
          environmentName: lastUsedEnvironment.environmentName
        }
      } else {
        return env 
      }
    })

    if (!foundSameCloud) {    // no environment with the same cloud found
      updatedLastUsedEnvironmentList.push(lastUsedEnvironment)
    }

    // update state first, then save the state into local storage
    commit('setLastUsedEnvironmentList', { updatedLastUsedEnvironmentList })
    dispatch('save', { username })
  },
  save({ state }, { username }) {
    // save the state into local storage
    localStorage.setItem(`${LOCALSTORAGE_KEY}-${username}`, JSON.stringify(state))
  },

}

const getters = {
  getUserSettings(state) {
    return state 
  },
  getLastUsedEnvironment: (state, _a, _b, rootGetters) => function({ cloud }) {
    return state.lastUsedEnvironmentList
      .filter((e) => rootGetters.lookupEnvironment(e.name))
      .find((e) => e.cloud === cloud)?.environmentName
  }
}

export default {
  state, mutations, actions, getters
}
