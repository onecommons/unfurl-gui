import {createApp, h} from 'vue';
import Dashboard from './dashboard.vue';
import { GlToast, GlTooltipDirective } from '@gitlab/ui';
import store from './store';
import createRouter from './router';
import { FLASH_TYPES } from 'oc_vue_shared/client_utils/oc-flash';
import {OcComponents} from 'oc_vue_shared/components/oc/plugin'
import '../project_overview/assets/global.css' // TODO move this somewhere better
import {normpath} from 'oc_vue_shared/lib/normalize'
import {mountReplacing} from 'oc_vue_shared/lib/mount-app'

const router = createRouter(store)

export default (elemId='js-table-component') => {
    import('./layout-fix.css')
    const element = document.getElementById(elemId);
    window.gon = {...window.gon, ...element.dataset}
    window.gon.home_project = normpath(window.gon.home_project)
    window.gon.working_dir_project = normpath(window.gon.working_dir_project)

    if(window.Cypress || sessionStorage['debug'] || sessionStorage['unfurl-gui:state']) {
        window.$store = store
    }

    const app = createApp({render: () => h(Dashboard)})

    app.use(store)
    app.use(router)
    app.use(GlToast)
    app.use(OcComponents)
    app.directive('gl-tooltip', GlTooltipDirective)

    app.config.errorHandler = function(err, vm, info) {
        console.error(err)
        if(err.flash) {
            return $store.dispatch('createFlash', { message: err.message, type: FLASH_TYPES.ALERT })
        }
    }

    return mountReplacing(app, element)
};
