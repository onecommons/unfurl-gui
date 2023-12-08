import Vue from 'vue'
import Vuex from 'vuex'
import deployment_template_updates from "../packages/oc-pages/project_overview/store/modules/deployment_template_updates"
import environments from "../packages/oc-pages/project_overview/store/modules/environments";
import templateResources from "../packages/oc-pages/project_overview/store/modules/template_resources";
import project_application_blueprint from '../packages/oc-pages/project_overview/store/modules/project_application_blueprint'
import deployments from '../packages/oc-pages/project_overview/store/modules/deployments'
import errors from '../packages/oc-pages/vue_shared/store_modules/errors'
import misc from '../packages/oc-pages/project_overview/store/modules/misc'

Vue.use(Vuex)

const store = new Vuex.Store({
  modules: {
    environments, deployments, deployment_template_updates, templateResources,
    project_application_blueprint, errors, misc
  },
  strict: false
})

export default store
