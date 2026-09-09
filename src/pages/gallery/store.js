import Vuex from 'vuex'

/*
 * The union of what the gallery's components map from the store, and nothing
 * else. Each getter returns the smallest value that makes its component render
 * a meaningful state rather than an empty one -- an import-link with no
 * deployment to resolve renders nothing at all, which is not worth a
 * screenshot.
 *
 * Shared with the dev-settings and fork-inputs pages, which mount components
 * that need a different `gon` but the same store.
 */
export default new Vuex.Store({
  state: {
    autostop: null,
    environmentVariables: {},
    // GithubMirroredRepoImageSource reads state.misc.user directly
    misc: {user: {external: false, email: 'gallery@example.com'}}
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
    getApplicationBlueprint: () => ({name: 'gallery', projectPath: 'onecommons/blueprints/gallery'}),
    // fork-inputs
    cardIsValid: () => () => true,
    lookupEnvironmentVariable: () => name => (name == 'PROJECT_DNS_ZONE' ? 'gallery.test' : null),
    // UnfurlCNamedDNSZone walks dependents looking for a `subdomain` property;
    // the fixture card carries one, so the walk stops before this is called
    getDependent: () => () => null,
    registryURL: () => null
  },
  mutations: {
    setAutostop(state, value) { state.autostop = value },
    /*
     * The deploy and save hooks take a callback to run against a real
     * deployment. Nothing on these pages deploys, so registering is enough.
     */
    onDeploy() {},
    onSaveEnvironment() {},
    setUpstreamProject() {},
    setUpstreamBranch() {},
    setUpstreamCommit() {},
    setUpstreamId() {}
  },
  actions: {
    setEnvironmentVariable({state}, {name, value}) { state.environmentVariables[name] = value },
    createFlash() {},
    updateProperty() {},
    updateCardInputValidStatus() {}
  }
})
