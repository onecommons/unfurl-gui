import Vue from 'vue';
import Vuex from 'vuex';
import * as actions from './actions';
import * as getters from './getters';
import mutations from './mutations';
import state from './state';

Vue.use(Vuex);

// OC change oc
export function asModule(initialState = {}) {
    return {
        actions,
        mutations,
        getters,
        state: {
            ...state(),
            ...initialState,
        },
    }
}

export default (initialState = {}) =>
  new Vuex.Store({
    actions,
    mutations,
    getters,
    state: {
      ...state(),
      ...initialState,
    },
  });
