import Vue from 'vue'
import VueRouter from 'vue-router'
import {GlTooltipDirective} from '@gitlab/ui'
import {Popover as ElPopover, Loading as ElLoading} from 'element-ui'
import {setupTheme} from 'oc_vue_shared/theme'
import {OcComponents} from 'oc_vue_shared/components/oc/plugin'
// same global setup the real entry points do; without setupTheme the element
// widgets render unstyled
import 'oc_pages/project_overview/assets/global.css'
import OcInputs from 'oc_pages/project_overview/components/shared/oc_inputs.vue'
import store from './store'
import { card } from './schema'

Vue.use(VueRouter)
Vue.use(OcComponents)
Vue.component('el-popover', ElPopover)
Vue.directive('loading', ElLoading)
Vue.directive('gl-tooltip', GlTooltipDirective)
setupTheme(Vue)

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
