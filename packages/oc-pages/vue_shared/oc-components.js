import Vue from 'vue';

export { default as DetectIcon } from './components/oc/detect-icon.vue'
export {default as OcPropertiesList} from './components/oc/oc-properties-list.vue'
export {default as DeploymentResources} from './components/oc/deployment-resources.vue'
export {default as OcTab} from './components/oc/oc-tab.vue'

export let CiVariableSettings, createCiVariablesStore
export const PageNotFound = Vue.component("page-not-found", {
  template: "",
  created: function() {
      window.location.href = "/404.html";
  }
})

// #!if false
import _CiVariableSettings from './oc_ci_variable_list/components/ci_variable_settings.vue'
// #!if false
import {asModule} from './oc_ci_variable_list/store'
// #!if false
CiVariableSettings = _CiVariableSettings; createCiVariablesStore = asModule

