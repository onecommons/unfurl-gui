import '../../assets/standalone-base.css'
import {createApp, h} from 'vue'
import VueRouter from 'vue-router'
import {GlTooltipDirective} from '@gitlab/ui'
import {OcComponents} from 'oc_vue_shared/components/oc/plugin'
// widgets render unstyled
import 'oc_pages/project_overview/assets/global.css'
import OcInputs from 'oc_pages/project_overview/components/shared/oc_inputs.vue'
import store from './store'
import { card } from './schema'

// oc_inputs reads $route.params.slug in triggerSave
const router = new VueRouter({
  mode: 'history',
  routes: [{ path: '/:slug*', name: 'fixture', component: { render: () => h('div') } }]
})

// so a spec can read what the form model produced
window.$store = store

const app = createApp({
  render: () => h('div', [h(OcInputs, { card, wrapper: 'div' })])
})
app.use(store)
app.use(router)
app.use(OcComponents)
app.directive('gl-tooltip', GlTooltipDirective)
app.mount('#form-fixture')
