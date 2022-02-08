import Vue from "vue";
import Vuex from "vuex";
import createLogger from "vuex/dist/logger";
//import environments from "./modules/environments";
//import project from "./modules/project";
//import deployment_template_updates from "./modules/deployment_template_updates";
//import templateResources from "./modules/template_resources";
import deployments from '../../project_overview/store/modules/deployments'
import environments from '../../project_overview/store/modules/environments'
import project_application_blueprint from '../../project_overview/store/modules/project_application_blueprint';
//import misc from './modules/misc';

Vue.use(Vuex);

const debug = process.env.NODE_ENV !== "production";

const store = new Vuex.Store({
    modules: {
        project_application_blueprint,
        environments,
        deployments,
    },
    strict: debug,
    plugins: debug && process.env.VUEX_LOGGER === "true" ? [createLogger()] : [],
});

export default store;
