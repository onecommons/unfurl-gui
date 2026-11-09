import {shallowMount, flushPromises} from '@vue/test-utils'
import Main from './main.vue'

jest.mock('@gitlab/ui', () => new Proxy({}, {
    get(_target, name) {
        if(typeof name != 'string') return undefined
        if(name == '__esModule') return true
        if(name.endsWith('Directive')) return {}
        const props = new Proxy({}, {get: () => ({validator: () => true})})
        return {name, props, render: () => null}
    },
}))

// The fork never sets gon.home_project, so the overview names the dashboard
// from the route. A dashboard project with another name must not fall back
// to the default name.
it('takes the namespace and the dashboard from the route', async () => {
    window.gon = {}
    const $store = {
        getters: new Proxy({getHomeProjectPath: null}, {has: () => true, get: (t, k) => t[k]}),
        dispatch: jest.fn(() => Promise.resolve()),
        commit: jest.fn(),
    }
    shallowMount(Main, {
        global: {
            mocks: {$store, $route: {params: {dashboard: encodeURIComponent('org/team/mydash')}, query: {}, name: 'projectHome'}, $router: {push: jest.fn()}, $projectGlobal: {}},
            stubs: {RouterView: true},
        },
    })
    await flushPromises()
    expect($store.commit).toHaveBeenCalledWith('setCurrentNamespace', 'org/team')
    expect($store.commit).toHaveBeenCalledWith('setDashboardName', 'mydash')
})
