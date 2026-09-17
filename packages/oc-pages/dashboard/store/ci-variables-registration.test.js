/*
 * #js-oc-ci-variables is rendered `- if @environment`, from that one
 * environment. The dashboard is an SPA, so anything lifted out of that dataset
 * outlives the environment it describes -- which is how one environment's GCP
 * Project ID came to show on another's Cloud Provider card.
 *
 * Only project-level keys are taken from it now. This asserts the per-
 * environment ones cannot get in.
 */

// The store barrel (oc_vue_shared/components/oc) pulls the component index in
// with it, and @gitlab/ui ships untransformed esm. Nothing here renders.
jest.mock('@gitlab/ui', () => new Proxy({}, {get: (target, prop) => {
    if (prop === '__esModule') return true
    if (String(prop).endsWith('Directive')) return {mounted() {}, updated() {}}
    return {name: String(prop), render: () => null, props: {size: {validator: () => true}}}
}}))
jest.mock('~/tracking', () => ({
    mixin: () => ({methods: {track() {}, trackEvent() {}}}),
    event: () => {},
}))

const DATASET = {
    // project-level, safe to seed once
    endpoint: '/group/dash/-/variables',
    projectId: '42',
    maskableRegex: '^[a-zA-Z0-9_+=/@:.~-]{8,}$',
    // per-environment: rendered from @environment and stale the moment the
    // user routes to another one
    environmentName: 'env-a',
    primaryProviderGcpProjectId: 'env-a-project',
    primaryProviderGcpZone: 'us-central1-c',
    primaryProviderAwsDefaultRegion: 'us-east-2',
    primaryProviderAwsRoleArn: 'arn:aws:iam::123456789012:role/unfurl',
}

const PER_ENVIRONMENT_KEYS = [
    'primaryProviderGcpProjectId',
    'primaryProviderGcpZone',
    'primaryProviderAwsDefaultRegion',
    'primaryProviderAwsRoleArn',
]

function loadStore({withDataset = true} = {}) {
    document.body.innerHTML = ''
    if (withDataset) {
        const el = document.createElement('div')
        el.id = 'js-oc-ci-variables'
        Object.entries(DATASET).forEach(([key, value]) => { el.dataset[key] = value })
        document.body.appendChild(el)
    }

    let store
    jest.isolateModules(() => { store = require('./index').default })
    return store
}

describe('ci_variables module registration', () => {
    beforeEach(() => {
        window.gon = {unfurl_gui: false, home_project: 'group/dash'}
    })

    it('registers the module for the fork build', () => {
        expect(loadStore().state.ci_variables).toBeDefined()
    })

    // The element is absent on every dashboard page but an environment's, and
    // the Variables tab does not consult it -- without this the tab mounted
    // against a namespace that was never registered.
    it('registers it even when the element is not on the page', () => {
        expect(loadStore({withDataset: false}).state.ci_variables).toBeDefined()
    })

    /*
     * The endpoint cannot be built here. The only home-project value in scope at
     * module load is gon.home_project, which standalone's Jinja skeleton sets
     * and the fork never sets at all -- so deriving it here produced
     * `/-/variables` on the one build this module is registered for, and the
     * variables table answered "There was an error fetching the variables".
     * ci_variable_settings dispatches it from getHomeProjectPath instead.
     */
    it('leaves the endpoint for the component to dispatch', () => {
        expect(loadStore({withDataset: false}).state.ci_variables.endpoint).toBe(null)
    })

    it('does not build one out of gon.home_project, which the fork never sets', () => {
        delete window.gon.home_project

        expect(loadStore().state.ci_variables.endpoint).not.toBe('/-/variables')
    })

    it('keeps the project-level keys it does need', () => {
        const {projectId, maskableRegex} = loadStore().state.ci_variables

        expect(projectId).toBe('42')
        expect(maskableRegex).toBe(DATASET.maskableRegex)
    })

    it.each(PER_ENVIRONMENT_KEYS)('does not seed %s from the dataset', key => {
        expect(loadStore().state.ci_variables[key]).toBeUndefined()
    })

    // environmentName is declared in state.js and set from the route, so the
    // page it is on decides it -- it must not arrive pre-filled from a dataset
    // describing whichever environment was server-rendered.
    it('leaves environmentName for the route to set', () => {
        expect(loadStore().state.ci_variables.environmentName).toBe(null)
    })

    it('registers nothing in standalone, which has no variables api', () => {
        window.gon = {unfurl_gui: true, home_project: 'group/dash'}

        expect(loadStore({withDataset: false}).state.ci_variables).toBeUndefined()
    })
})
