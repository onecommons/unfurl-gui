import {mount, flushPromises} from '@vue/test-utils'
import EnvironmentCell from './environment-cell.vue'

jest.mock('oc_vue_shared/components/oc', () => ({DetectIcon: {name: 'DetectIcon', props: ['type', 'size'], render: () => null}}))
jest.mock('oc_vue_shared/client_utils/environments', () => ({fetchDashboardProviders: jest.fn()}))
const {fetchDashboardProviders} = require('oc_vue_shared/client_utils/environments')

const $store = {getters: {getHomeProjectPath: 'me/dashboard'}, commit: jest.fn()}
const mountCell = environment => mount(EnvironmentCell, {
    props: {environment, noRouter: true},
    global: {mocks: {$store}, config: {errorHandler: e => { throw e }}},
})

beforeEach(() => { window.gon = {} })

// merge-requests-table passes null when a merge request's environment
// label names no known environment.
it('renders nothing for a missing environment', async () => {
    const errors = []
    const wrapper = mount(EnvironmentCell, {
        props: {environment: null, noRouter: true},
        global: {mocks: {$store}, config: {errorHandler: e => errors.push(e)}},
    })
    await flushPromises()
    expect(errors).toEqual([])
    expect(wrapper.html()).toBe('<!--v-if-->')
})

it('falls back to the provider the dashboard records', async () => {
    fetchDashboardProviders.mockResolvedValue({providersByEnvironment: {prod: ['aws']}})
    const wrapper = mountCell({name: 'prod'})
    await flushPromises()
    expect(wrapper.findComponent({name: 'DetectIcon'}).props('type')).toBe('aws')
})

it('shows no provider when the dashboard records none', async () => {
    fetchDashboardProviders.mockResolvedValue({providersByEnvironment: {}})
    const wrapper = mountCell({name: 'prod'})
    await flushPromises()
    expect(wrapper.findComponent({name: 'DetectIcon'}).exists()).toBe(false)
})
