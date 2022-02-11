import Vue from 'vue';
//import TableComponentContainer from './components/table.vue';
import Dashboard from './dashboard.vue'
import apolloProvider from './graphql';
import { GlToast } from '@gitlab/ui';
import store from './store';
import createRouter from './router'

Vue.use(GlToast);
const router = createRouter()

export default (elemId='js-table-component') => {
    const element = document.getElementById(elemId);

    return new Vue({
        el: element,
        apolloProvider,
        store,
        router,
        render(createElement) {
            return createElement(Dashboard);
        },
    });
};
