import Vue from 'vue';
import TableComponent from "../../gitlab-oc/dashboard/components/table.vue";
import { GlToast } from '@gitlab/ui';
import Translate from '~/vue_shared/translate';
import Layout from "../../components/Layout.vue";

import setConfigs from "@gitlab/ui/dist/config";
setConfigs();

import apolloProvider from './graphql';

if (process.env.NODE_ENV !== 'production') {
  Vue.config.productionTip = false;
}
Vue.use(Translate);
Vue.use(GlToast);


// from oc/app/assets/javascripts/table/index.js:
const element = document.getElementById("app");

Vue.component('MainBody', TableComponent);
const vue = new Vue({
  el: element,
  apolloProvider,
  render(createElement) {
    return createElement(Layout);
  },
}).$mount("#app");
