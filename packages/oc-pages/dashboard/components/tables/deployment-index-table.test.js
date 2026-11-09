import {shallowMount, config} from '@vue/test-utils'
import {nextTick} from 'vue'
import DeploymentIndexTable from './deployment-index-table.vue'

jest.mock('@gitlab/ui', () => new Proxy({}, {
    get(_target, name) {
        if(typeof name != 'string') return undefined
        if(name == '__esModule') return true
        if(name.endsWith('Directive')) return {}
        const props = new Proxy({}, {get: () => ({validator: () => true})})
        return {name, props, render: () => null}
    },
}))
jest.mock('oc_vue_shared/components/oc', () => {
    const stub = name => ({name, props: ['provider', 'modelValue', 'environment', 'deployment', 'teardown'], render: () => null})
    return {OcTab: stub('OcTab'), EnvironmentSelection: stub('EnvironmentSelection'), LocalDeploy: stub('LocalDeploy'), AutostopInner: stub('AutostopInner')}
})

beforeAll(() => { config.global.renderStubDefaultSlot = true })
afterAll(() => { config.global.renderStubDefaultSlot = false })

function mountTable() {
    window.gon = {}
    const getters = new Proxy({mergeRequests: [], deploymentItemDirect: () => undefined}, {get: (t, k) => t[k]})
    return shallowMount(DeploymentIndexTable, {
        props: {items: []},
        global: {mocks: {$store: {getters, dispatch: jest.fn(), commit: jest.fn()}, $route: {query: {}, params: {}, hash: ''}, $router: {replace: jest.fn()}, __: s => s}},
    })
}

// Local environments have no primary provider, and any deployment can be cloned.
it('opens the clone dialog for a deployment in an environment without a provider', async () => {
    const wrapper = mountTable()
    wrapper.vm.onIntentToClone({name: 'app', title: 'App'}, {name: 'local'})
    await nextTick()
    const selection = wrapper.findComponent({name: 'EnvironmentSelection'})
    expect(selection.exists()).toBe(true)
    expect(selection.props('provider')).toBeUndefined()
})
