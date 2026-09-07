import Vue from 'vue'
import Vuex from 'vuex'
import { inputsSchema } from './schema'

Vue.use(Vuex)

/*
 * The smallest store oc_inputs.vue will run against: the five getters it maps,
 * the three mutations and the one action. `saved` records what updateProperty
 * received, which is how the spike checks that values round-trip out of the
 * form model rather than merely rendering.
 */
export default new Vuex.Store({
  state: {
    saved: {},
    validity: {}
  },
  getters: {
    resourceTemplateInputsSchema: () => () => inputsSchema,
    resolveResourceTemplateType: () => () => ({ name: 'FixtureType' }),
    cardInputsAreValid: () => () => true,
    lookupEnvironmentVariable: () => () => null,
    userCanEdit: () => true
  },
  mutations: {
    pushPreparedMutation() {},
    clientDisregardUncommitted() {},
    setInputValidStatus(state, { path, status }) {
      state.validity[path] = status
    },
    recordSave(state, { propertyName, propertyValue }) {
      state.saved[propertyName] = propertyValue
    }
  },
  actions: {
    updateProperty({ commit }, payload) {
      commit('recordSave', payload)
    }
  }
})
