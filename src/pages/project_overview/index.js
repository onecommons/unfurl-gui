import Vue from 'vue';
import Translate from '~/vue_shared/translate';
import Layout from "../../components/Layout.vue";

import setConfigs from "@gitlab/ui/dist/config";

import MainComponent from '../../gitlab-oc/project_overview/components/main.vue';
import createRouter from '../../gitlab-oc/project_overview/router';
import store from '../../gitlab-oc/project_overview/store';
import __ from '~/locale';

import '../../gitlab-oc/project_overview/assets/global.css';

import apolloProvider from "~/graphql-shim.js";
import overview from '../../gitlab-oc/project_overview'

setConfigs();
if (process.env.NODE_ENV !== 'production') {
  Vue.config.productionTip = false;
}
Vue.use(Translate);

// from oc/app/assets/javascripts/pages/projects/overview/index.js

const vue = overview('js-oc-project-overview')
vue.$mount('#app')

if(window.Cypress) {
  window.app = vue
}

/*
const element = document.getElementById('js-oc-project-overview');
const {
  projectPath,
  treePath,
  ref,
  projectIcon,
  projectName,
  buttonId,
  buttonStarText,
  buttonStarLink,
  buttonStarIcon,
  buttonStarCount,
  buttonStarEndpoint,
  buttonForkPath,
  buttonForkLink,
  buttonForkCount,
  linkDeployment,
} = element.dataset;

const router = createRouter(projectPath);

Vue.prototype.$projectGlobal = {
  projectPath,
  projectIcon,
  buttonId,
  treePath,
  projectName,
  ref,
  buttonStar : {
    text: buttonStarText,
    link: buttonStarLink,
    icon: buttonStarIcon,
    count: buttonStarCount,
    endpoint: buttonStarEndpoint
  },
  buttonFork: {
    path: buttonForkPath,
    link: buttonForkLink,
    count: buttonForkCount
  },
  linkDeployment,
};

Vue.component('MainBody', MainComponent);
const vue = new Vue({
  el: element,
  apolloProvider,
  store,
  router,
  render(createElement) {
    return createElement(Layout);
  },
}).$mount("#app");

*/

