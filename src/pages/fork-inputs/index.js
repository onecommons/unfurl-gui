import '../../assets/standalone-tokens.css'
import Vue from 'vue'
import Vuex from 'vuex'
import VueRouter from 'vue-router'
import {GlTooltipDirective} from '@gitlab/ui'
import {OcComponents} from 'oc_vue_shared/components/oc/plugin'
import 'oc_pages/project_overview/assets/global.css'
import store from '../gallery/store'
import {installApiStub} from './api-stub'

/*
 * Runs before any widget mounts, which is all the ordering that matters: the
 * fetches happen in data() and in an immediate watcher, not at import time.
 */
installApiStub()

/*
 * Imported directly, because oc_inputs/index.js hides these four behind a
 * standalone preprocessor conditional and that loader only runs on .js.
 * Async, so vue-apollo and graphql-tag -- which the app itself compiles out --
 * land in this page's own chunk instead of the vendors bundle every page
 * loads.
 */
const LocalImageRepoSource = () => import('oc_pages/project_overview/components/shared/oc_inputs/LocalImageRepoSource.vue')
const UnfurlCloudMirroredRepoImageSource = () => import('oc_pages/project_overview/components/shared/oc_inputs/UnfurlCloudMirroredRepoImageSource.vue')
const GithubMirroredRepoImageSource = () => import('oc_pages/project_overview/components/shared/oc_inputs/GithubMirroredRepoImageSource.vue')
const UnfurlCNamedDNSZone = () => import('oc_pages/project_overview/components/shared/oc_inputs/UnfurlCNamedDNSZone.vue')

Vue.use(Vuex)
Vue.use(VueRouter)
Vue.use(OcComponents)
Vue.directive('gl-tooltip', GlTooltipDirective)

// the shared updateValue mixin reads $route.params.slug
const router = new VueRouter({
  mode: 'history',
  routes: [{path: '/:slug*', component: {render: h => h('div')}}]
})

const card = (name, properties) => ({
  name,
  properties: Object.entries(properties).map(([key, value]) => ({name: key, value}))
})

const ENTRIES = [
  {
    name: 'local-image-repo-source',
    component: LocalImageRepoSource,
    // project_id preset on purpose: the watcher that would otherwise fetch it
    // is not immediate, so the container-image suggestions fall through to the
    // REST endpoint rather than the GraphQL client, which is a hard null in a
    // standalone build
    props: {
      card: card('local_image', {
        project_id: 'onecommons/blueprints/gallery',
        repository_id: null,
        repository_tag: null,
        registry_url: null
      })
    }
  },
  {
    name: 'uc-mirrored-repo-image-source',
    component: UnfurlCloudMirroredRepoImageSource,
    props: {
      card: card('uc_mirror', {
        project_id: 'onecommons/blueprints/media-service',
        branch: null,
        repository_tag: null
      })
    }
  },
  {
    name: 'uc-mirrored-repo-image-source-readonly',
    component: UnfurlCloudMirroredRepoImageSource,
    props: {
      readonly: true,
      card: card('uc_mirror_readonly', {
        project_id: 'onecommons/blueprints/media-service',
        branch: 'staging',
        repository_tag: null
      })
    }
  },
  {
    name: 'github-mirrored-repo-image-source',
    component: GithubMirroredRepoImageSource,
    props: {
      card: card('github_mirror', {
        github_project: 'octocat/hello-world',
        branch: 'staging'
      })
    }
  },
  {
    // target_subdomain is seeded from Math.random() in data() unless the card
    // supplies one, and it is rendered -- so without this the screenshot
    // differs on every run
    name: 'unfurl-cnamed-dns-zone',
    component: UnfurlCNamedDNSZone,
    props: {
      card: card('dns_zone', {
        target_subdomain: 'g4l1ery0fixed',
        name: 'example.com',
        subdomain: 'app'
      })
    }
  },
  {
    // the domain the stub never fully resolves, so verifying parks here: the
    // only state that shows the per-nameserver badges and the button spinner
    name: 'unfurl-cnamed-dns-zone-verifying',
    component: UnfurlCNamedDNSZone,
    props: {
      card: card('dns_zone_partial', {
        target_subdomain: 'g4l1ery1fixed',
        name: 'partial.test',
        subdomain: 'app'
      })
    }
  }
]

// one component throwing should not cost the others their screenshots
const Boundary = {
  props: {name: String},
  data: () => ({failed: null}),
  errorCaptured(err) { this.failed = err.message; return false },
  render(h) {
    return h('div', {
      attrs: {'data-testid': `fork-inputs-${this.name}`},
      class: 'gallery-entry'
    }, [
      h('h3', {class: 'gallery-title'}, this.name),
      this.failed
        ? h('pre', {attrs: {'data-testid': `fork-inputs-${this.name}-error`}, class: 'gallery-error'}, this.failed)
        : this.$slots.default
    ])
  }
}

new Vue({
  store,
  router,
  render: h => h('div', {class: 'gallery'}, ENTRIES.map(({name, component, props}) =>
    h(Boundary, {props: {name}, key: name}, [h(component, {props: props || {}})])
  ))
}).$mount('#fork-inputs')
