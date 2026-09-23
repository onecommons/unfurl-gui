import {shallowMount} from '@vue/test-utils'
import Vuex from 'vuex'
import EnvironmentCreationDialog from './environment-creation-dialog.vue'

// @gitlab/ui ships untransformed esm that jest does not transpile out of
// node_modules; shallowMount stubs all of these anyway
jest.mock('@gitlab/ui', () => {
    const stub = name => ({name, render: () => null})
    return {
        GlFormGroup: stub('GlFormGroup'),
        GlFormInput: stub('GlFormInput'),
        GlDropdown: stub('GlDropdown'),
        GlDropdownItem: stub('GlDropdownItem'),
        GlDropdownDivider: stub('GlDropdownDivider'),
        GlFormCheckbox: stub('GlFormCheckbox'),
        // detect-icon deletes GlIcon.props.size.validator at module scope, so
        // this one needs the real shape rather than a bare stub
        GlIcon: {name: 'GlIcon', props: {size: {validator: () => true}}, render: () => null},
        GlLink: stub('GlLink'),
        GlAlert: stub('GlAlert'),
        GlButton: stub('GlButton'),
        GlTooltipDirective: {},
    }
})
jest.mock('oc_vue_shared/client_utils/environments', () => ({
    postGitlabEnvironmentForm: jest.fn(),
    initUnfurlEnvironment: jest.fn(),
    declareAvailableProviders: jest.fn(),
}))

const RETURN_TO = '/onecommons/blueprints/minecraft/-/overview?fn=Mine'

function mountDialog() {
    const store = new Vuex.Store({
        getters: {
            lookupEnvironment: () => () => null,
            getHomeProjectPath: () => 'root/dashboard',
            availableProviders: () => [],
            hasCriticalErrors: () => false,
        },
        actions: {environmentFromProvider: jest.fn(), ocFetchEnvironments: jest.fn()},
        mutations: {createError: jest.fn()},
    })

    const wrapper = shallowMount(EnvironmentCreationDialog, {
        global: {plugins: [store], mocks: {__: s => s}},
    })
    // the network half of creation; this asserts on where the user is sent
    wrapper.vm.createEnvironmentWithoutCluster = jest.fn()
    return wrapper
}

describe('returning to the page that asked for an environment', () => {
    let location

    beforeEach(() => {
        sessionStorage.clear()
        // pathname/search included: the no-target path falls back to them
        location = {href: '', pathname: '/root/dashboard/-/environments', search: ''}
        delete window.location
        window.location = location
    })

    /*
     * The redirect is only ever fired by a provider panel's save handler, so a
     * provider that opens no panel has nothing to fire it. Digital Ocean is
     * that case: its template is written at creation, and it has no dedicated
     * panel, so the target used to be stored and never read -- the user was
     * left on the environment page waiting for a trip that could not happen.
     */
    it.each(['Digital Ocean', 'Azure', 'Kubernetes'])(
        'goes straight back when %s opens no provider panel',
        async (provider) => {
            const wrapper = mountDialog()
            await wrapper.setData({environmentName: 'do-1', selectedCloudProvider: provider})

            await wrapper.vm.beginEnvironmentCreation(RETURN_TO)

            expect(location.href).toBe(RETURN_TO)
            // nothing would ever read it, so storing it only strands the user
            expect(sessionStorage.redirectOnProviderSaved).toBeUndefined()
            // and the page it returns to preselects what was just made
            expect(sessionStorage.instantiate_env).toBe('do-1')
        },
    )

    // gcp and aws do get a panel, so the trip waits for that panel's save
    it.each([['Google Cloud Platform', 'gcp'], ['Amazon Web Services', 'aws']])(
        'defers to the provider panel for %s',
        async (provider, short) => {
            const wrapper = mountDialog()
            await wrapper.setData({environmentName: 'env-1', selectedCloudProvider: provider})

            await wrapper.vm.beginEnvironmentCreation(RETURN_TO)

            expect(sessionStorage.redirectOnProviderSaved).toBe(RETURN_TO)
            expect(location.href).toContain(`/-/environments/env-1?provider=${short}`)
            // the panel's save sets these, not us
            expect(sessionStorage.instantiate_env).toBeUndefined()
        },
    )

    // no caller asked to be returned anywhere, so neither key is touched
    it('stores nothing when there is no return target', async () => {
        const wrapper = mountDialog()
        await wrapper.setData({environmentName: 'solo', selectedCloudProvider: 'Digital Ocean'})

        await wrapper.vm.beginEnvironmentCreation()

        expect(sessionStorage.redirectOnProviderSaved).toBeUndefined()
        expect(sessionStorage.instantiate_env).toBeUndefined()
    })
})
