import '../../assets/standalone-base.css'
import {createApp, h} from 'vue'
import VueRouter from 'vue-router'
import {OcComponents} from 'oc_vue_shared/components/oc/plugin'
import 'oc_pages/project_overview/assets/global.css'
import store from '../gallery/store'
import ExperimentalSettingsIndicator from 'oc_vue_shared/components/oc/experimental-settings-indicator.vue'

// the indicator opens its modal from $route.query['dev-settings']
const router = new VueRouter({
  mode: 'history',
  routes: [{path: '/:slug*', component: {render: () => h('div')}}]
})

const app = createApp({render: () => h(ExperimentalSettingsIndicator)})
app.use(store)
app.use(router)
app.use(OcComponents)
app.mount('#dev-settings')
