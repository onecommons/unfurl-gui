import Vue from 'vue';

export { default as DetectIcon } from './components/oc/detect-icon.vue'
export { default as StatusIcon } from './components/oc/Status.vue'
export { default as ProjectIcon } from './components/oc/project-icon.vue'
export { default as Status } from './components/oc/Status.vue'
export {default as OcPropertiesList} from './components/oc/oc-properties-list.vue'
export {default as DeploymentResources} from './components/oc/deployment-resources.vue'
export {default as OcTab} from './components/oc/oc-tab.vue'
export {default as GitHubRepos} from './components/oc/github-repos.vue'
export {default as ErrorSmall} from './components/oc/ErrorSmall.vue'
export {default as EmptyStateJob} from './components/oc/empty-state-job.vue'
export {default as EnvironmentSelection} from './components/oc/environment-selection.vue'
export {default as DeploymentScheduler} from './components/oc/deployment-scheduler.vue'

export let CiVariableSettings, createCiVariablesStore
import {notFoundError, removeNotFoundError} from 'oc_vue_shared/client_utils/error'
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
import _CiVariableSettings from './oc_ci_variable_list/components/ci_variable_settings.vue'
// #!if false
import {asModule} from './oc_ci_variable_list/store'
// #!if false
CiVariableSettings = _CiVariableSettings; createCiVariablesStore = asModule

