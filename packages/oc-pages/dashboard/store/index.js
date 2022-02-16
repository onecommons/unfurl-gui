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
import misc from '../../project_overview/store/modules/misc'
import deployment_template_updates from '../../project_overview/store/modules/deployment_template_updates'
import template_resources from '../../project_overview/store/modules/template_resources'
import table_data from './modules/table_data'
//import misc from './modules/misc';

Vue.use(Vuex);

const debug = process.env.NODE_ENV !== "production";

const store = new Vuex.Store({
    modules: {
        project_application_blueprint,
        environments,
        deployments,
        misc,
        deployment_template_updates,
        template_resources,
        table_data,
    },
    strict: debug,
    plugins: debug && process.env.VUEX_LOGGER === "true" ? [createLogger()] : [],
});

export default store;
