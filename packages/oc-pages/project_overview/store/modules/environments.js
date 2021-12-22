import { __ } from "~/locale";

const state = {
    environmentName: __("Oc Default"),
};

const mutations = {

    SET_ENVIRONMENT_NAME(_state, { envName }) {
        // eslint-disable-next-line no-param-reassign
        _state.environmentName = envName;
    },

};

const actions = {

    setEnvironmentName({ commit }, envName) {
        commit("SET_ENVIRONMENT_NAME", { envName });
    },
};

const getters = {
    getEnvironmentName: _state => _state.environmentName,
};

export default {
    state,
    mutations,
    actions,
    getters
};