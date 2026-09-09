/*
 * vuex 4 dropped the dist/logger entry point and exports createLogger from the
 * package root instead. oc-pages still imports the old path because that is
 * what resolves in the fork, which keeps vuex 3 installed for its Vue 2 lane.
 */
export {createLogger as default} from '@gitlab/vuex-vue3'
