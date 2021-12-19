import Vue from 'vue';
import TableComponent from "./components/table.vue";
import Translate from '~/vue_shared/translate';
import { createProvider } from "../../vue-apollo";
import Layout from "../../components/Layout.vue";

import setConfigs from "@gitlab/ui/dist/config";
setConfigs();


if (process.env.NODE_ENV !== 'production') {
  Vue.config.productionTip = false;
}
Vue.use(Translate);

// from oc/app/assets/javascripts/table/index.js:
const element = document.getElementById("js-table-component");

Vue.component('MainBody', TableComponent);
const vue = new Vue({
  el: element,
  apolloProvider: createProvider(),
  render(createElement) {
    return createElement(Layout);
  },
}).$mount("#app");
