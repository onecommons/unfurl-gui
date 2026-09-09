/*
 * What `vue` resolves to in the standalone build.
 *
 * The alias points here rather than straight at @vue/compat so that
 * configureCompat runs before any component module is evaluated: ESM hoists a
 * page entry's imports above its body, so a configureCompat() call written at
 * the top of an entry would still land after @gitlab/ui and oc-pages had been
 * pulled in.
 *
 * The fork's equivalent is app/assets/javascripts/lib/utils/vue3compat/vue.js.
 * Its Vue subclass is not copied: that exists to reproduce Vue 2's "replace the
 * mount element" behaviour for `new Vue({el})`, and standalone mounts with
 * createApp, which never replaced it.
 */
import Vue from '@vue/compat'

import {compatConfig} from './compat_config'

export * from '@vue/compat'

/*
 * Four flags turned off on top of the fork's config: Vue.set, Vue.delete,
 * Vue.observable and filters. An audit of every compat flag found these are
 * the only ones neither oc-pages nor @gitlab/ui uses; everything else
 * @gitlab/ui needs, so it stays on globally and a per-component compatConfig
 * is the only lever for our own code. All four are guarded by
 * assertCompatEnabled, so reaching for one now throws instead of quietly
 * working. Set here rather than in compat_config.js, a verbatim fork copy.
 *
 * GLOBAL_PROTOTYPE is deliberately NOT among them, though nothing here reads
 * Vue.prototype. applySingletonPrototype gates on it before rebasing
 * globalProperties onto Vue.prototype, which is what makes
 * globalProperties.constructor resolve to Vue -- and @gitlab/ui's vendored
 * bootstrap-vue reads exactly that to spawn every tooltip, popover and toast.
 * Turning it off breaks them all, silently and with no exception.
 */
Vue.configureCompat({
    ...compatConfig,
    GLOBAL_SET: false,
    GLOBAL_DELETE: false,
    GLOBAL_OBSERVABLE: false,
    FILTERS: false
})

export default Vue
