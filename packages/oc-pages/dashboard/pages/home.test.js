import {shallowMount} from '@vue/test-utils'
import Vuex from 'vuex'
import Home from './home.vue'
import QuantityCard from '../components/quantity-card.vue'

// @gitlab/ui ships untransformed esm that jest does not transpile out of
// node_modules. aws-provider-setup.test.js lists its stubs by name; home pulls
// the library in through a chain of children, so stub whatever is asked for.
jest.mock('@gitlab/ui', () => new Proxy({}, {
    get(_target, name) {
        if(typeof name != 'string') return undefined
        if(name == '__esModule') return true
        if(name.endsWith('Directive')) return {}

        // detect-icon.vue reaches into GlIcon.props.size at module load, so the
        // stubs need props that answer to whatever a caller asks about
        const props = new Proxy({}, {get: () => ({validator: () => true})})

        return {name, props, render: () => null}
    },
}))

const CLONE_HASH = '#clone-instructions'

const store = new Vuex.Store({
    getters: {
        getDashboardItems: () => [],
        runningDeploymentsCount: () => 0,
        totalDeploymentsCount: () => 0,
        environmentsCount: () => 0,
        applicationsCount: () => 0,
        mergeRequests: () => [],
    },
})

let $router, $route

function mountHome() {
    return shallowMount(Home, {
        global: {
            plugins: [store],
            mocks: {__: s => s, $router, $route},
            // <center> in the empty-state slot is not a component and not on
            // Vue's list of known html tags, so it warns on every render
            stubs: {center: true},
        },
    })
}

// home.vue reaches for the link with a document-wide query, because it lives in
// the README's v-html rather than the component's own markup.
function renderReadmeLink(href) {
    document.body.innerHTML = `<div class="gl-markdown"><a href="${href}">clone this project locally</a></div>`
    return document.querySelector('.gl-markdown a')
}

describe('home', () => {
    beforeEach(() => {
        $router = {replace: jest.fn(), resolve: () => ({href: '/acme/dash'})}
        $route = {hash: '', path: '/', query: {}}
        window.gon = {}
    })

    afterEach(() => { document.body.innerHTML = '' })

    it('routes the readme clone link instead of letting the browser follow it', () => {
        const link = renderReadmeLink(`http://gdk.test:3000/root/dashboard/${CLONE_HASH}`)
        mountHome()

        expect(link.getAttribute('href')).toEqual(CLONE_HASH)

        const click = new MouseEvent('click', {bubbles: true, cancelable: true})
        link.dispatchEvent(click)

        // vue-router 4 never sees a plain anchor, so the navigation has to go
        // through the router or the modal's $route.hash binding never fires
        expect(click.defaultPrevented).toBe(true)
        expect($router.replace).toHaveBeenCalledWith(expect.objectContaining({hash: CLONE_HASH}))
    })

    it('leaves a modified click to the browser, so open-in-new-tab still works', () => {
        const link = renderReadmeLink(CLONE_HASH)
        mountHome()

        const click = new MouseEvent('click', {bubbles: true, cancelable: true, metaKey: true})
        link.dispatchEvent(click)

        expect(click.defaultPrevented).toBe(false)
        expect($router.replace).not.toHaveBeenCalled()
    })

    // quantity-card renders a plain <a href> for a string and a router-link for
    // an object, and only the latter reaches the dialog's $route.hash binding
    it('points the running deployments card at the router in standalone', async () => {
        // set on the instance rather than window.gon, which home.vue reads once
        // at module scope
        const wrapper = mountHome()
        wrapper.vm.standalone = true
        await wrapper.vm.$nextTick()

        const card = wrapper.findAllComponents(QuantityCard)[2]

        expect(card.props('secondaryLink')).toEqual({hash: '#new-deployment'})
    })

    it('points it at the blueprint catalog in the fork', () => {
        const card = mountHome().findAllComponents(QuantityCard)[2]

        expect(card.props('secondaryLink')).toEqual('/explore/blueprints')
    })

    it('stops listening once unmounted', () => {
        const link = renderReadmeLink(CLONE_HASH)
        const wrapper = mountHome()
        wrapper.unmount()

        link.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true}))

        expect($router.replace).not.toHaveBeenCalled()
    })
})
