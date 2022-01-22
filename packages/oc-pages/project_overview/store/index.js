import Vue from "vue";
import Vuex from "vuex";
import createLogger from "vuex/dist/logger";
import environments from "./modules/environments";
import project from "./modules/project";
import deployment_template_updates from "./modules/deployment_template_updates"
import templateResources from "./modules/template_resources";
import project_application_blueprint from './modules/project_application_blueprint'
import misc from './modules/misc'

Vue.use(Vuex);

const debug = process.env.NODE_ENV !== "production";

const store = new Vuex.Store({
    modules: {
        environments,
        project,
        templateResources,
        deployment_template_updates,
        project_application_blueprint,
        misc
    },
    strict: debug,
    plugins: debug && process.env.VUEX_LOGGER === "true" ? [createLogger()] : [],
});

export default store;
