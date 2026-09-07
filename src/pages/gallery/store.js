import Vue from 'vue'
import Vuex from 'vuex'

Vue.use(Vuex)

/*
 * The union of what the gallery's components map from the store, and nothing
 * else. Each getter returns the smallest value that makes its component render
 * a meaningful state rather than an empty one -- an import-link with no
 * deployment to resolve renders nothing at all, which is not worth a
 * screenshot.
 */
export default new Vuex.Store({
  state: {
    autostop: null,
    environmentVariables: {}
  },
  getters: {
    getHomeProjectPath: () => 'onecommons/blueprints/gallery',
    lookupDeployment: () => (name, environment) => ({
      name, title: 'Gallery Deployment', _environment: environment
    }),
    getCurrentNamespace: () => 'onecommons/blueprints',
    lookupVariableByEnvironment: () => () => null,
    getDeploymentTemplate: () => ({name: 'gallery-template'}),
    getCurrentEnvironment: () => ({name: 'gallery-environment'}),
    getCurrentContext: () => 'deployment',
    windowWidth: () => 1280,
    // file-selector
    getCurrentProjectPath: () => 'onecommons/blueprints/gallery',
    getCurrentEnvironmentName: () => 'gallery-environment',
    getApplicationBlueprint: () => ({name: 'gallery', projectPath: 'onecommons/blueprints/gallery'})
  },
  mutations: {
    setAutostop(state, value) { state.autostop = value }
  },
  actions: {
    setEnvironmentVariable({state}, {name, value}) { state.environmentVariables[name] = value },
    createFlash() {}
  }
})
