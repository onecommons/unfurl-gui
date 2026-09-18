import Vuex from "vuex";
import {normpath} from 'oc_vue_shared/lib/normalize'
import {projectPathToHomeRoute} from 'oc_vue_shared/client_utils/dashboard'
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
import unfurl_metadata from './modules/unfurl-metadata'
import health_check from 'oc_vue_shared/store_modules/health-check'
import errors from 'oc_vue_shared/store_modules/errors'
import merge_requests from 'oc_vue_shared/store_modules/merge-requests'
import {createCiVariablesStore} from 'oc_vue_shared/components/oc'
import {setEventErrorReporter} from 'oc_vue_shared/client_utils/unfurl-server-events'

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
    merge_requests,
    unfurl_metadata
}
const variableDataEl = document.querySelector('#js-oc-ci-variables')

// Registered for the whole fork build, not only when the dataset element is on
// the page. The element is rendered `- if @environment`, but this is an SPA:
// land on /-/environments and route to one, and the Variables tab (gated on
// `userCanEdit && !standalone`, which does not consult this) mounted against a
// module that was never registered -- a flood of "[vuex] module namespace not
// found in mapState(): ci_variables/".
//
// Only the project-level keys are taken. The dataset is rendered from
// `@environment`, so spreading it whole seeded the store with that one
// environment's provider values -- primaryProviderGcpProjectId and friends --
// which then outlived it: environment.vue read them back out of this state and
// showed one environment's Project ID, Zone or Region on another's.
//
// endpoint is not set here. It needs the home project path, and the only source
// available at module scope is gon.home_project -- which the Jinja skeleton sets
// for standalone and the fork never sets at all, so deriving it here yielded
// `/-/variables` on exactly the build this module is registered for.
// ci_variable_settings dispatches it from getHomeProjectPath instead.
if(!gon.unfurl_gui) {
    const {projectId, maskableRegex} = variableDataEl?.dataset || {}
    const ci_variables = createCiVariablesStore({
        projectId,
        maskableRegex,
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

// A write discarded after the response came back has no caller left to throw
// at -- the promise resolved when the proxy queued it. This is what puts that
// failure in the same box a synchronous one lands in.
setEventErrorReporter(payload => store.commit('createError', payload))

export default store;
