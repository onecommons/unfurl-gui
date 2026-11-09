// Vuex 4 declares only the `store` option; `this.$store` is the app's to add.
// Untyped state: the same components run under two stores whose module sets
// differ (template_resources is `templateResources` in project_overview, and
// ci_variables exists only in the fork), and they read almost nothing from
// state directly -- getters and actions, which mapGetters/mapActions leave
// loose regardless.
import type {Store} from '@gitlab/vuex-vue3'

declare module 'vue' {
  interface ComponentCustomProperties {
    $store: Store<any>
  }
}

declare module '@gitlab/vuex-vue3' {
  interface Store<S> {
    // Vuex internals, keyed by action name. oc_list and dependency read it to
    // tell whether the store they run under registers setRequirementSelected.
    _actions: Record<string, unknown>
  }
}
