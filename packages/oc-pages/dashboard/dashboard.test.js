// @gitlab/ui ships untransformed esm that jest does not transpile out of
// node_modules, and importing the SFC pulls it in
jest.mock('@gitlab/ui', () => new Proxy({}, {
    get(_target, name) {
        if(typeof name != 'string') return undefined
        if(name == '__esModule') return true

        const props = new Proxy({}, {get: () => ({validator: () => true})})

        return {name, props, render: () => null}
    },
}))

import {shallowMount, flushPromises} from '@vue/test-utils'
import Dashboard, {pollableDashboardItem} from './dashboard.vue'

const environment = {name: 'do3'}
const deployment = {name: 'minecraft'}

describe('pollableDashboardItem', () => {
    it('accepts an item with both halves', () => {
        expect(pollableDashboardItem({deployment, environment})).toBe(true)
    })

    // table_data builds a row for every environment, and sets deployment to
    // null on the ones with nothing deployed. There is no url to poll there,
    // and asking anyway is what filled the console.
    it('rejects the row an empty environment gets', () => {
        expect(pollableDashboardItem({deployment: null, environment})).toBe(false)
    })

    it('rejects an item still missing its environment', () => {
        expect(pollableDashboardItem({deployment, environment: null})).toBe(false)
    })

    it('rejects nothing at all', () => {
        expect(pollableDashboardItem(undefined)).toBe(false)
    })
})

describe('a queued deployment', () => {
    function mountDashboard(deployInto) {
        const getters = {getDashboardItems: [], getUsername: 'me', getHomeProjectPath: 'me/dashboard'}
        const $store = {
            getters: new Proxy(getters, {has: () => true, get: (t, k) => k in t ? t[k] : undefined}),
            dispatch: jest.fn((name, payload) => name == 'deployInto' ? deployInto(payload) : Promise.resolve()),
            commit: jest.fn(),
        }
        const $router = {options: {base: '/me/dashboard'}, replace: jest.fn()}
        const wrapper = shallowMount(Dashboard, {
            global: {mocks: {$store, $router, $route: {hash: ''}}, stubs: {RouterView: true}},
        })
        return {wrapper, $store}
    }

    beforeEach(() => {
        window.gon = {home_project: 'me/dashboard'}
        sessionStorage.clear()
        jest.spyOn(console, 'error').mockImplementation(() => {})
    })
    afterEach(() => jest.restoreAllMocks())

    it('reports a failed trigger, with what was queued, and finishes loading', async () => {
        sessionStorage['trigger-deployment'] = JSON.stringify({deployment: 'app'})
        const {wrapper, $store} = mountDashboard(() => Promise.reject(new Error('no runner')))
        await flushPromises()

        expect($store.commit).toHaveBeenCalledWith('createError', {
            message: 'Failed to trigger queued deployment: no runner',
            context: {deployment: 'app'},
        })
        expect(wrapper.vm.isLoaded).toBe(true)
    })

    it('runs a queued deployment once', async () => {
        sessionStorage['trigger-deployment'] = JSON.stringify({deployment: 'app'})
        const deployInto = jest.fn(() => Promise.resolve())
        const {wrapper} = mountDashboard(deployInto)
        await flushPromises()

        expect(deployInto).toHaveBeenCalledWith({deployment: 'app'})
        expect(sessionStorage['trigger-deployment']).toBeUndefined()
        expect(wrapper.vm.isLoaded).toBe(true)
    })
})
