import type {ActionContext, Module} from '@gitlab/vuex-vue3'

const LOCALSTORAGE_KEY = 'us'

interface LastUsedEnvironment {
  cloud: string
  environmentName: string
}

interface State {
  lastUsedEnvironmentList: LastUsedEnvironment[]
  acknowledged?: Record<string, string>
  [setting: string]: unknown
}

type Context = ActionContext<State, any>

const state = (): State => ({
  lastUsedEnvironmentList: [],
})

const mutations = {
  initUserSettings(state: State, { username }: {username: string}) {
    Object.assign(state, JSON.parse(localStorage.getItem(`${LOCALSTORAGE_KEY}-${username}`)!))
    if(!state.acknowledged) state.acknowledged = {}
  },
  setLastUsedEnvironmentList(state: State, { updatedLastUsedEnvironmentList }: {updatedLastUsedEnvironmentList: LastUsedEnvironment[]}) {
    state.lastUsedEnvironmentList = updatedLastUsedEnvironmentList
  },
  // not meant to be used publicly
  _applyUserSetting(state: State, {key, value}: {key: string, value: unknown}) {
    state[key] = value
  }
}

const actions = {
  applyUserSetting({commit, dispatch, rootGetters}: Context, props: {key: string, value: unknown}) {
    commit('_applyUserSetting', props)
    dispatch('save', {username: rootGetters.getUsername})
  },

  acknowledge({state, dispatch}: Context, acknowledgement: string) {
    dispatch('applyUserSetting', {key: 'acknowledged', value: {...state.acknowledged, [acknowledgement]: '1'}})
  },

  updateLastUsedEnvironment({ commit, dispatch, state }: Context, { lastUsedEnvironment, username }: {lastUsedEnvironment: LastUsedEnvironment, username: string}) {
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
  save({ state }: Context, { username }: {username: string}) {
    // save the state into local storage
    localStorage.setItem(`${LOCALSTORAGE_KEY}-${username}`, JSON.stringify(state))
  },

}

const getters = {
  getUserSettings(state: State) {
    return state
  },
  userSettings(state: State) {
    return state
  },
  isAcknowledged(state: State) {
    return function(acknowledgement: string) {
      return state.acknowledged?.hasOwnProperty(acknowledgement)
    }
  },
  getLastUsedEnvironment: (state: State, _a: unknown, _b: unknown, rootGetters: any) => function({ cloud }: {cloud: string}) {
    return state.lastUsedEnvironmentList
      // skip one deleted since
      .filter((e) => rootGetters.lookupEnvironment(e.environmentName))
      .find((e) => e.cloud === cloud)?.environmentName
  }
}

export default {
  state, mutations, actions, getters
} satisfies Module<State, any>
