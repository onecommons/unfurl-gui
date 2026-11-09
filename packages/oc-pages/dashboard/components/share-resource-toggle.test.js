import {shallowMount, flushPromises} from '@vue/test-utils'
import Vuex from 'vuex'
import ShareResourceToggle from './share-resource-toggle.vue'

jest.mock('@gitlab/ui', () => new Proxy({}, {
    get(_target, name) {
        if(typeof name != 'string') return undefined
        if(name == '__esModule') return true
        if(name.endsWith('Directive')) return {}
        const props = new Proxy({}, {get: () => ({validator: () => true})})
        return {name, props, render: () => null}
    },
}))

// The share actions take a page-wide lock; one that fails must not leave it
// held, or every later share or unshare waits forever.
it('still shares after a share fails', async () => {
    window.gon = {}
    let fail = true
    const unshareResource = jest.fn()
    const store = new Vuex.Store({
        getters: {
            getCurrentEnvironment: () => ({name: 'prod'}), getDeploymentTemplate: () => ({name: 'app'}),
            getResourceSharedState: () => () => null, getHomeProjectPath: () => 'me/dashboard',
            resolveResourceTypeFromAny: () => () => null, userCanEdit: () => true,
        },
        actions: {
            updateResourceSharedState: () => { if(fail) { fail = false; throw new Error('refused') } },
            unshareResource,
            loadDashboard: () => {},
        },
    })
    const wrapper = shallowMount(ShareResourceToggle, {props: {card: {name: 'db'}}, global: {plugins: [store]}})

    await expect(wrapper.vm.shareWithEnvironment()).rejects.toThrow('refused')
    const next = wrapper.vm.stopSharing()
    await flushPromises()

    expect(unshareResource).toHaveBeenCalled()
    await next
})
