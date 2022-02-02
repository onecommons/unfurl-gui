import Vue from 'vue';
import TableComponent from "../../gitlab-oc/dashboard/components/table.vue";
import { GlToast } from '@gitlab/ui';
import Translate from '~/vue_shared/translate';
import Layout from "../../components/Layout.vue";
import dashboard from '../../gitlab-oc/dashboard'

import setConfigs from "@gitlab/ui/dist/config";
setConfigs();

if (process.env.NODE_ENV !== 'production') {
  Vue.config.productionTip = false;
}
Vue.use(Translate);


dashboard("app").$mount('#app')

