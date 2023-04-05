import Vue from "vue";
import Vuex from "vuex";
// TODO move these modules to vue_shared
import deployments from '../../project_overview/store/modules/deployments'
import environments from '../../project_overview/store/modules/environments'
import user_settings from '../../project_overview/store/modules/user_settings'
import project_application_blueprint from '../../project_overview/store/modules/project_application_blueprint';
import misc from '../../project_overview/store/modules/misc'
import deployment_template_updates from '../../project_overview/store/modules/deployment_template_updates'
import template_resources from '../../project_overview/store/modules/template_resources'
import table_data from './modules/table_data'
import deployment_info from './modules/deployment-info'
import health_check from 'oc_vue_shared/store_modules/health-check'
import errors from 'oc_vue_shared/store_modules/errors'
import merge_requests from 'oc_vue_shared/store_modules/merge-requests'
import {createCiVariablesStore} from 'oc_vue_shared/components/oc'

Vue.use(Vuex);

const development = process.env.NODE_ENV !== "production";

const modules = {
    project_application_blueprint,
    environments,
    deployments,
    misc,
    deployment_template_updates,
    template_resources,
    table_data,
    deployment_info,
    user_settings,
    health_check,
    errors,
    merge_requests
}
const variableDataEl = document.querySelector('#js-oc-ci-variables')

if(variableDataEl && !gon.unfurl_gui) {
    const ci_variables = createCiVariablesStore({
        ...variableDataEl.dataset,
        // TODO properly read these values
        isGroup: false,
        isProtectedByDefault: false
    })
    ci_variables.namespaced = true
    modules.ci_variables = ci_variables
}


const store = new Vuex.Store({
    modules,
    strict: development,
    plugins: development && process.env.VUEX_LOGGER === "true" ? [createLogger()] : [],
});

export default store;
