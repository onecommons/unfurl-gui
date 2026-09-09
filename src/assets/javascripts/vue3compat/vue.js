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

Vue.configureCompat(compatConfig)

export default Vue
