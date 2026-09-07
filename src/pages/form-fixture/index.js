import Vue from 'vue'
import VueRouter from 'vue-router'
import OcInputs from 'oc_pages/project_overview/components/shared/oc_inputs.vue'
import store from './store'
import { card } from './schema'

Vue.use(VueRouter)

// oc_inputs reads $route.params.slug in triggerSave
const router = new VueRouter({
  mode: 'history',
  routes: [{ path: '/:slug*', name: 'fixture', component: { render: h => h('div') } }]
})

// so a spec can read what the form model produced
window.$store = store

new Vue({
  store,
  router,
  render: h => h('div', [h(OcInputs, { props: { card, wrapper: 'div' } })])
}).$mount('#form-fixture')
