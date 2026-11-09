import {shallowMount, flushPromises} from '@vue/test-utils'
import Vuex from 'vuex'
import BaseDeployDialog from './base-deploy-dialog.vue'

jest.mock('@gitlab/ui', () => new Proxy({}, {
    get(_target, name) {
        if(typeof name != 'string') return undefined
        if(name == '__esModule') return true
        if(name.endsWith('Directive')) return {}
        const props = new Proxy({}, {get: () => ({validator: () => true})})
        return {name, props, render: () => null}
    },
}))
jest.mock('oc_vue_shared/client_utils/projects', () => ({
    fetchCurrentTag: () => Promise.resolve(null),
    fetchBranches: () => Promise.resolve([]),
    getOrFetchDefaultBranch: () => Promise.resolve('main'),
}))

// user_settings saves under the username it is given and loads under the
// signed-in one, so the last-used environment only comes back if they match.
it('records the last-used environment for the signed-in user', async () => {
    window.gon = {unfurl_gui: true}
    const updateLastUsedEnvironment = jest.fn()
    const store = new Vuex.Store({
        getters: {
            getUsername: () => 'alice', getHomeProjectPath: () => 'alice/dashboard',
            getNextDefaultDeploymentName: () => () => 'App', environmentsAreReady: () => false,
            lookupEnvironment: () => () => null, getMatchingEnvironments: () => () => [],
            getDefaultEnvironmentName: () => null, lookupDeploymentOrDraft: () => () => null,
            getLastUsedEnvironment: () => null,
        },
        actions: {updateLastUsedEnvironment},
    })
    const route = {query: {fn: 'App'}, params: {}}
    const wrapper = shallowMount(BaseDeployDialog, {
        props: {templateSelected: {name: 'aws', cloud: 'aws', environment: 'prod'}, applicationBlueprint: {title: 'App'}, projectPath: 'org/app'},
        global: {plugins: [store], mocks: {$route: route, $router: {replace: jest.fn(), resolve: () => ({href: '/'}), name: 'dashboard'}, $projectGlobal: {}, __: s => s}},
    })
    await flushPromises()
    await wrapper.setData({selectedEnvironment: {name: 'prod'}})
    delete window.location
    window.location = {href: ''}

    wrapper.vm.redirectToTemplateEditor()

    expect(updateLastUsedEnvironment).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({username: 'alice'}))
})
