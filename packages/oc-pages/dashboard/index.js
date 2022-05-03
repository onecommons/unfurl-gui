import Vue from 'vue';
//import TableComponentContainer from './components/table.vue';
import Dashboard from './dashboard.vue'
import apolloProvider from './graphql';
import { GlToast, GlTooltipDirective } from '@gitlab/ui';
import store from './store';
import createRouter from './router'
import createFlash, { FLASH_TYPES } from '../vue_shared/client_utils/oc-flash';
import '../project_overview/assets/global.css' // TODO move this somewhere better


import 'element-ui/lib/theme-chalk/index.css'

Vue.use(GlToast);
Vue.directive('gl-tooltip', GlTooltipDirective)
const router = createRouter()
Vue.config.errorHandler = function(err, vm, info) {
    console.error(err)
    if(err.flash) {
        return createFlash({ message: err.message, type: FLASH_TYPES.ALERT, projectPath: store.getters.getHomeProjectPath});
    }
}

export default (elemId='js-table-component') => {
    const element = document.getElementById(elemId);
    window.gon = {...window.gon, ...element.dataset}

    const vm = new Vue({
        el: element,
        apolloProvider,
        store,
        router,
        render(createElement) {
            return createElement(Dashboard);
        },
    });

    if(window.Cypress || sessionStorage['debug']) {
        window.$store = vm.$store
    }

    return vm
};
