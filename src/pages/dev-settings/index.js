import Vue from 'vue'
import Vuex from 'vuex'
import VueRouter from 'vue-router'
import {OcComponents} from 'oc_vue_shared/components/oc/plugin'
import 'oc_pages/project_overview/assets/global.css'
import store from '../gallery/store'
import ExperimentalSettingsIndicator from 'oc_vue_shared/components/oc/experimental-settings-indicator.vue'

Vue.use(Vuex)
Vue.use(VueRouter)
Vue.use(OcComponents)

// the indicator opens its modal from $route.query['dev-settings']
const router = new VueRouter({
  mode: 'history',
  routes: [{path: '/:slug*', component: {render: h => h('div')}}]
})

new Vue({store, router, render: h => h(ExperimentalSettingsIndicator)}).$mount('#dev-settings')
