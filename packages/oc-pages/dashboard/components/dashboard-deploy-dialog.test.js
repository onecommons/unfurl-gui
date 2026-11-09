import {shallowMount} from '@vue/test-utils'
import Vuex from 'vuex'
import DashboardDeployDialog from './dashboard-deploy-dialog.vue'

// @gitlab/ui ships untransformed esm that jest does not transpile out of
// node_modules; stub whatever the component chain reaches for
jest.mock('@gitlab/ui', () => new Proxy({}, {
    get(_target, name) {
        if(typeof name != 'string') return undefined
        if(name == '__esModule') return true
        if(name.endsWith('Directive')) return {}

        const props = new Proxy({}, {get: () => ({validator: () => true})})

        return {name, props, render: () => null}
    },
}))
jest.mock('oc_vue_shared/client_utils/unfurl-server', () => ({unfurlServerExport: jest.fn()}))

const NEW_DEPLOYMENT_HASH = '#new-deployment'

const store = new Vuex.Store({
    getters: {
        environmentsAreReady: () => false,
        environmentResourceTypeDict: () => () => ({}),
    },
    actions: {environmentFetchTypesWithParams: jest.fn()},
    mutations: {createError: jest.fn()},
})

let $router, $route

function mountDialog() {
    return shallowMount(DashboardDeployDialog, {
        global: {plugins: [store], mocks: {__: s => s, $router, $route}},
    })
}

describe('dashboard-deploy-dialog', () => {
    beforeEach(() => {
        $router = {push: jest.fn(), replace: jest.fn()}
        $route = {hash: '', path: '/', query: {}, name: 'dashboardHome', params: {}}
        window.location.hash = ''
    })

    // vue-router 4 only listens for popstate, so writing window.location.hash
    // moved the URL without moving $route.hash, which `enabled` reads
    it('opens through the router rather than window.location', () => {
        const wrapper = mountDialog()

        wrapper.vm.enabled = true

        expect($router.push).toHaveBeenCalledWith(expect.objectContaining({hash: NEW_DEPLOYMENT_HASH}))
        expect(window.location.hash).toEqual('')
    })

    it('clears the hash through the router when stepping back', () => {
        const wrapper = mountDialog()
        $route.hash = NEW_DEPLOYMENT_HASH

        wrapper.vm.backSelectAppBlueprint()

        expect($router.push).toHaveBeenCalledWith(expect.objectContaining({hash: ''}))
    })

    it('does not navigate when the hash is already what it wants', () => {
        const wrapper = mountDialog()
        $route.hash = NEW_DEPLOYMENT_HASH

        wrapper.vm.navigateToHash(NEW_DEPLOYMENT_HASH)

        expect($router.push).not.toHaveBeenCalled()
    })

    it('reads its open state from the route, not the browser', () => {
        $route.hash = NEW_DEPLOYMENT_HASH

        expect(mountDialog().vm.enabled).toBe(true)
    })

    // vue-router 4 resolves a navigation after the call returns, so $route
    // does not change while reset() is still running.
    it('resets from the template step without waiting on the route', () => {
        $route.query = {blueprintProject: 'org/blueprint', ts: 'aws'}
        let replaced = 0
        $router.replace = jest.fn(() => {
            if(++replaced > 20) throw new Error('reset() keeps navigating')
            return Promise.resolve()
        })
        const wrapper = mountDialog()

        wrapper.vm.reset()

        expect(replaced).toBeLessThan(20)
    })

    // Each navigation starts from $route.query; until one lands, the next
    // replaces it, so clearing parameters one at a time keeps only the last.
    it('steps back from the template step in one navigation', () => {
        $route.query = {blueprintProject: 'org/blueprint', ts: 'aws', fn: 'App', keep: '1'}
        const wrapper = mountDialog()

        wrapper.vm.back()

        expect($router.replace).toHaveBeenCalledTimes(1)
        expect($router.replace.mock.calls[0][0].query).toEqual({keep: '1'})
    })

    it('closes from the template step in one navigation, clearing the hash too', () => {
        $route.query = {blueprintProject: 'org/blueprint', ts: 'aws', keep: '1'}
        $route.hash = NEW_DEPLOYMENT_HASH
        const wrapper = mountDialog()

        wrapper.vm.reset()

        const navigations = [...$router.push.mock.calls, ...$router.replace.mock.calls]
        expect(navigations).toHaveLength(1)
        expect(navigations[0][0]).toMatchObject({query: {keep: '1'}, hash: ''})
    })
})

