import Vue from "vue";
import Layout from "../../components/Layout.vue";
import HelloWorld from "../../components/HelloWorld.vue";
import setConfigs from "@gitlab/ui/dist/config";
import 'element-ui/lib/theme-chalk/index.css';

setConfigs();
if (process.env.NODE_ENV !== 'production') {
  Vue.config.productionTip = false;
}

Vue.component('MainBody', HelloWorld);
// XXX replace HelloWorld with this pages component for example:
//Vue.component('MainBody', FormilyComponent);

new Vue({
  render: h => h(Layout)
}).$mount("#app");
