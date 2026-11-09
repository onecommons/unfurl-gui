import {mount} from '@vue/test-utils'
import EnvironmentSelection from './environment-selection.vue'

jest.mock('@gitlab/ui', () => new Proxy({}, {
    get(_target, name) {
        if(typeof name != 'string') return undefined
        if(name == '__esModule') return true
        if(name.endsWith('Directive')) return {}
        const props = new Proxy({}, {get: () => ({validator: () => true})})
        return {name, props, render: () => null}
    },
}))

beforeEach(() => { window.gon = {unfurl_gui: true} })
afterEach(() => jest.restoreAllMocks())

// The clone dialog in deployment-index-table binds an environment's name,
// not the environment.
it('accepts an environment name and selects that environment', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const env = {name: 'prod', _dashboard: 'me/dashboard'}
    const $store = {getters: {
        lookupEnvironment: name => (name == 'prod' ? env : undefined),
        getMatchingEnvironments: () => [env],
        getHomeProjectPath: 'me/dashboard',
        additionalDashboardProviders: [],
    }, dispatch: jest.fn()}
    const wrapper = mount(EnvironmentSelection, {
        props: {modelValue: 'prod', provider: 'aws'},
        global: {mocks: {$store, __: s => s}, stubs: {ErrorSmall: true, DetectIcon: true}},
    })
    expect(wrapper.emitted('update:modelValue')[0]).toEqual([env])
    expect(warn.mock.calls.map(c => String(c[0])).filter(m => m.includes('Invalid prop'))).toEqual([])
})
