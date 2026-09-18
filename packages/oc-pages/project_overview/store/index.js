import Vuex from "vuex";
import createLogger from "vuex/dist/logger";
import environments from "./modules/environments";
import project from "./modules/project";
import deployment_template_updates from "./modules/deployment_template_updates"
import templateResources from "./modules/template_resources";
import project_application_blueprint from './modules/project_application_blueprint'
import deployment_info from '../../dashboard/store/modules/deployment-info'
import misc from './modules/misc'
import deployments from './modules/deployments'
import user_settings from './modules/user_settings'
import health_check from 'oc_vue_shared/store_modules/health-check'
import errors from 'oc_vue_shared/store_modules/errors'
import merge_requests from 'oc_vue_shared/store_modules/merge-requests'
import {setEventErrorReporter} from 'oc_vue_shared/client_utils/unfurl-server-events'

const development = process.env.NODE_ENV !== "production";

const store = new Vuex.Store({
    modules: {
        misc,
        deployments,
        environments,
        project,
        templateResources,
        deployment_template_updates,
        project_application_blueprint,
        deployment_info,
        user_settings,
        health_check,
        errors,
        merge_requests,
    },
    strict: development,
    plugins: development && process.env.VUEX_LOGGER === "true" ? [createLogger()] : [],
});

// A write discarded after the response came back has no caller left to throw
// at -- the promise resolved when the proxy queued it. This is what puts that
// failure in the same box a synchronous one lands in.
setEventErrorReporter(payload => store.commit('createError', payload))

export default store;
