import Vue from 'vue';
import Dashboard from './dashboard.vue';
import apolloProvider from './graphql';
import { GlToast, GlTooltipDirective } from '@gitlab/ui';
import store from './store';
import createRouter from './router';
import { FLASH_TYPES } from 'oc_vue_shared/client_utils/oc-flash';
import {setupTheme} from 'oc_vue_shared/theme'
import {Popover as ElPopover} from 'element-ui' // formily not finding popover correctly
import {OcComponents} from 'oc_vue_shared/components/oc/plugin'
import '../project_overview/assets/global.css' // TODO move this somewhere better

Vue.use(GlToast);
Vue.use(OcComponents)
Vue.directive('gl-tooltip', GlTooltipDirective)
Vue.component('el-popover', ElPopover)

setupTheme(Vue)

const router = createRouter()

Vue.config.errorHandler = function(err, vm, info) {
    console.error(err)
    if(err.flash) {
        return $store.dispatch('createFlash', { message: err.message, type: FLASH_TYPES.ALERT })
    }
}

export default (elemId='js-table-component') => {
    import('./layout-fix.css')
    const element = document.getElementById(elemId);
    window.gon = {...window.gon, ...element.dataset}

    if(window.Cypress || sessionStorage['debug'] || sessionStorage['unfurl-gui:state']) {
        window.$store = store
    }

    const vm = new Vue({
        el: element,
        apolloProvider,
        store,
        router,
        render(createElement) {
            return createElement(Dashboard);
        },
    });

    return vm
};
