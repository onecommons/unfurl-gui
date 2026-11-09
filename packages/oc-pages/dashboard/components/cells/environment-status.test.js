import {mount, flushPromises} from '@vue/test-utils'
import EnvironmentStatus from './environment-status.vue'

jest.mock('oc_vue_shared/components/oc/Status.vue', () => ({name: 'StatusIcon', props: ['status', 'size'], render: () => null}))
jest.mock('oc_vue_shared/client_utils/environments', () => ({fetchDashboardProviders: jest.fn()}))
const {fetchDashboardProviders} = require('oc_vue_shared/client_utils/environments')

// fetchDashboardProviders returns null in standalone and for a missing project.
it("doesn't keep the previous environment's status when there are no providers to read", async () => {
    fetchDashboardProviders.mockResolvedValueOnce({providersByEnvironment: {first: ['aws']}})
    const wrapper = mount(EnvironmentStatus, {
        props: {environment: {name: 'first'}},
        global: {mocks: {$store: {getters: {getHomeProjectPath: 'me/dashboard'}}}},
    })
    await flushPromises()
    expect(wrapper.findComponent({name: 'StatusIcon'}).props('status')).toBe(4)

    fetchDashboardProviders.mockResolvedValueOnce(null)
    await wrapper.setProps({environment: {name: 'second'}})
    await flushPromises()
    expect(wrapper.findComponent({name: 'StatusIcon'}).props('status')).toBe(1)
})
