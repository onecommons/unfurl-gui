import Vue from 'vue';
//import TableComponentContainer from './components/table.vue';
import Dashboard from './dashboard.vue'
import apolloProvider from './graphql';
import { GlToast } from '@gitlab/ui';
import store from './store';
import createRouter from './router'
import createFlash, { FLASH_TYPES } from '~/flash';

Vue.use(GlToast);
const router = createRouter()
Vue.config.errorHandler = function(err, vm, info) {
    console.error(err)
    if(err.flash) {
        return createFlash({ message: err.message, type: FLASH_TYPES.ALERT });
    }
}

export default (elemId='js-table-component') => {
    const element = document.getElementById(elemId);
    window.gon = {...window.gon, ...element.dataset}

    const result = new Vue({
        el: element,
        apolloProvider,
        store,
        router,
        render(createElement) {
            return createElement(Dashboard);
        },
    });
    //window.app = result
    return result
};
