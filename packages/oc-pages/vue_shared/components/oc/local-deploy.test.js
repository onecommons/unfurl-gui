import {shallowMount, flushPromises} from '@vue/test-utils'
import LocalDeploy from './local-deploy.vue'

jest.mock('@gitlab/ui', () => ({GlLoadingIcon: {name: 'GlLoadingIcon', render: () => null}}))
jest.mock('oc_vue_shared/client_utils/projects', () => ({fetchProjectInfo: jest.fn(() => Promise.resolve({id: 1}))}))
const {fetchProjectInfo} = require('oc_vue_shared/client_utils/projects')

// The dashboard's clone instructions have no deployment, so no blueprint.
it('looks up no blueprint without a deployment', async () => {
    window.gon = {projectId: 7}
    const getters = new Proxy({}, {get: () => undefined})
    shallowMount(LocalDeploy, {
        props: {instruction: 'clone'},
        global: {mocks: {$store: {getters, dispatch: jest.fn()}}},
    })
    await flushPromises()
    expect(fetchProjectInfo).not.toHaveBeenCalled()
})
