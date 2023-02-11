import Vue from 'vue';

export {default as DetectIcon} from 'oc/vue_shared/components/oc/detect-icon.vue'
export {default as StatusIcon} from 'oc/vue_shared/components/oc/Status.vue'
export {default as ProjectIcon} from 'oc/vue_shared/components/oc/project-icon.vue'
export {default as Status} from 'oc/vue_shared/components/oc/Status.vue'
export {default as OcPropertiesList} from 'oc/vue_shared/components/oc/oc-properties-list.vue'
export {default as DeploymentResources} from 'oc/vue_shared/components/oc/deployment-resources.vue'
export {default as OcTab} from 'oc/vue_shared/components/oc/oc-tab.vue'
export {default as GitHubRepos} from 'oc/vue_shared/components/oc/github-repos.vue'
export {default as ErrorSmall} from 'oc/vue_shared/components/oc/ErrorSmall.vue'
export {default as EmptyStateJob} from 'oc/vue_shared/components/oc/empty-state-job.vue'
export {default as EnvironmentSelection} from 'oc/vue_shared/components/oc/environment-selection.vue'
export {default as DeploymentScheduler} from 'oc/vue_shared/components/oc/deployment-scheduler.vue'
export {default as IncrementalDeploymentSwitch} from 'oc/vue_shared/components/oc/incremental-deployment-switch.vue'
export {default as LocalDeploy} from 'oc/vue_shared/components/oc/local-deploy.vue'
export {default as CodeClipboard} from 'oc/vue_shared/components/oc/code-clipboard.vue'
export {default as UnfurlGuiErrors} from 'oc/vue_shared/components/oc/ufgui-errors.vue'
export {default as ExperimentalSettingsIndicator} from 'oc/vue_shared/components/oc/experimental-settings-indicator.vue'

export let CiVariableSettings, createCiVariablesStore
import {notFoundError, removeNotFoundError} from 'oc/vue_shared/client_utils/error.js'
export const PageNotFound = Vue.component("page-not-found", {
  template: "",
  created() {
    notFoundError()
  },
  unmounted() {
    removeNotFoundError()
  }
})
export const SignIn = Vue.component("sign-in", { template: "", })
// #!if false
import _CiVariableSettings from 'oc/vue_shared/oc_ci_variable_list/components/ci_variable_settings.vue'
// #!if false
import {asModule} from 'oc/vue_shared/oc_ci_variable_list/store'
// #!if false
CiVariableSettings = _CiVariableSettings; createCiVariablesStore = asModule


