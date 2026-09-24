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
})
