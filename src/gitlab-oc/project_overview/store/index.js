import Vue from "vue";
import Vuex from "vuex";
import createLogger from "vuex/dist/logger";
import environments from "./modules/environments";
import project from "./modules/project";
import templateResources from "./modules/template_resources";

Vue.use(Vuex);

const debug = process.env.NODE_ENV !== "production";

const store = new Vuex.Store({
    modules: {
        environments,
        project,
        templateResources
    },
    strict: debug,
    plugins: debug && process.env.VUEX_LOGGER === "true" ? [createLogger()] : [],
});

export default store;
