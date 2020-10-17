import Vue from "vue";
import App from "./App.vue";
import { createProvider } from "./vue-apollo";
import setConfigs from "@gitlab/ui/dist/config";
setConfigs();

Vue.config.productionTip = false;

new Vue({
  apolloProvider: createProvider(),
  render: h => h(App)
}).$mount("#app");
