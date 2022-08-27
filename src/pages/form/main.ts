import Vue from "vue";
import Layout from "../../components/Layout.vue";
import Formily from "../../components/Formily.vue";
import setConfigs from "@gitlab/ui/dist/config";
import 'element-ui/lib/theme-chalk/index.css';

setConfigs();
if (process.env.NODE_ENV !== 'production') {
  Vue.config.productionTip = false;
}

Vue.component('MainBody', Formily);

new Vue({
  render: h => h(Layout)
}).$mount("#app");
