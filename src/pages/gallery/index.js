import Vue from 'vue'
import Vuex from 'vuex'
import {GlTooltipDirective} from '@gitlab/ui'
import {Popover as ElPopover, Loading as ElLoading} from 'element-ui'
import {setupTheme} from 'oc_vue_shared/theme'
import {OcComponents} from 'oc_vue_shared/components/oc/plugin'
// the design tokens, the tailwind gl-* utilities and the badge shim
import 'oc_pages/project_overview/assets/global.css'
import store from './store'
import {oauthStatus} from 'oc_vue_shared/client_utils/github-import'
import {CONFIGURABLE_HIDDEN_OPTIONS} from 'oc_vue_shared/storage-keys'

import Autostop from 'oc_vue_shared/components/oc/autostop.vue'
import AutostopInner from 'oc_vue_shared/components/oc/autostop-inner.vue'
import DeploymentScheduler from 'oc_vue_shared/components/oc/deployment-scheduler.vue'
import GithubAuth from 'oc_vue_shared/components/oc/github-auth.vue'
import ImportButton from 'oc_vue_shared/components/oc/import-button.vue'
import ImportLink from 'oc_vue_shared/components/oc/import-link.vue'
import ExperimentalSettingInput from 'oc_vue_shared/components/oc/experimental-settings-indicator/experimental-settings-input.vue'
import CloudTable from 'oc_pages/public_cloud/cloud-table.vue'
import MapControls from 'oc_pages/public_cloud/map-controls.vue'
// Imported directly, because oc_inputs/index.js hides it behind a standalone
// preprocessor conditional and that loader only runs on .js. Async, so its
// mime-types dependency lands in the gallery's own chunk: the vendors
// cacheGroup only collects initial chunks, and a static import here would put
// 144 KiB into the bundle every page shares for a component the app compiles
// out.
const FileSelector = () => import('oc_pages/project_overview/components/shared/oc_inputs/file-selector.vue')

Vue.use(Vuex)
/*
 * Everything dashboard/index.js and project_overview/index.js do before
 * mounting. setupTheme is the one that matters most: it loads element-ui's
 * theme-chalk and the dark overrides, and without it every el-* here renders
 * as an unstyled native control -- which makes the screenshots a poor guide
 * to what the component looks like in the app.
 */
Vue.use(OcComponents)
Vue.component('el-popover', ElPopover)
Vue.directive('loading', ElLoading)
Vue.directive('gl-tooltip', GlTooltipDirective)
setupTheme(Vue)

/*
 * Every component 2A.2 touches that renders on no route the specs visit.
 * One wrapper per component so the spec can screenshot them individually --
 * a whole-page shot would tell you something moved but not what.
 */
// cloud-table walks provider -> region -> testbed -> deployment; the page's own
// mock json is the inspector's shape, not this one
const CLOUD_TABLE_DATA = {
  children: [{
    name: 'Amazon Web Services',
    children: [{
      name: 'us-east-1',
      children: [{
        name: 'Gallery Testbed',
        children: [
          {name: 'wordpress', visit: 'https://unfurl.cloud/gallery/testbed/-/deployments/aws/wordpress'},
          {name: 'mediawiki', visit: 'https://unfurl.cloud/gallery/testbed/-/deployments/aws/mediawiki'}
        ]
      }]
    }]
  }]
}

const ENTRIES = [
  {name: 'autostop', component: Autostop},
  // both real mount points are ~470-500px wide (a popover and a gl-modal),
  // so a full-width entry would show a layout that exists nowhere
  {name: 'autostop-inner', component: AutostopInner, style: {maxWidth: '500px'}},
  {
    name: 'deployment-scheduler',
    component: DeploymentScheduler,
    props: {resourceName: 'gallery-resource', upstreamProject: 'onecommons/blueprints/upstream'}
  },
  {
    name: 'github-auth',
    component: GithubAuth,
    props: {importHandler: {status: oauthStatus.UNAUTHENTICATED}}
  },
  // the only v-loading in the app became a gl-loading-icon; it needs a state
  // to be visible in
  {
    name: 'github-auth-loading',
    component: GithubAuth,
    props: {importHandler: {status: null}}
  },
  {name: 'import-button', component: ImportButton, props: {repoImport: {}}},
  // padded so the popover, which centres on the badge, is not clipped by the
  // left edge of the page
  {
    name: 'import-link',
    component: ImportLink,
    props: {card: {name: 'env__deployment__resource', imported: true}},
    style: {paddingLeft: '10rem'}
  },
  {
    // a real option, so the fixture cannot drift from the shape the component
    // is actually given -- and `type` is not part of it
    name: 'experimental-settings-input',
    component: ExperimentalSettingInput,
    props: {option: CONFIGURABLE_HIDDEN_OPTIONS.find(o => o.key === 'defaultSeverityLevel')}
  },
  {
    name: 'file-selector',
    component: FileSelector,
    props: {value: null, schema: {title: 'Config file'}},
    style: {maxWidth: '760px'}
  },
  {name: 'cloud-table', component: CloudTable, props: {data: CLOUD_TABLE_DATA}},
  // map-controls-shell is `position: absolute; bottom: 1rem`, so it needs a
  // box tall enough to sit in or its zoom buttons ride up out of the entry
  {name: 'map-controls', component: MapControls, style: {minHeight: '170px'}}
]

// one component throwing should not cost the screenshots of the other eight
const Boundary = {
  props: {name: String, style: Object},
  data: () => ({failed: null}),
  errorCaptured(err) { this.failed = err.message; return false },
  render(h) {
    return h('div', {
      attrs: {'data-testid': `gallery-${this.name}`},
      class: 'gallery-entry',
      style: this.style || {}
    }, [
      h('h3', {class: 'gallery-title'}, this.name),
      this.failed
        ? h('pre', {attrs: {'data-testid': `gallery-${this.name}-error`}, class: 'gallery-error'}, this.failed)
        : this.$slots.default
    ])
  }
}

new Vue({
  store,
  render: h => h('div', {class: 'gallery'}, ENTRIES.map(({name, component, props, style}) =>
    h(Boundary, {props: {name, style}, key: name}, [h(component, {props: props || {}})])
  ))
}).$mount('#gallery')
