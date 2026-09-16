import { mount } from '@vue/test-utils'
import Vuex from 'vuex'
import axios from '~/lib/utils/axios_utils'
import Api from '~/api'
import CiVariableSettings from './ci_variable_settings.vue'
import CiVariableDrawer from './ci_variable_drawer.vue'
import CiVariableTable from './ci_variable_table.vue'
import { asModule } from '../store'
import { displayText } from '../constants'
import { variableTypes, ADD_VARIABLE_ACTION, EDIT_VARIABLE_ACTION } from '../constants_19_3'

/*
 * The seam that broke twice in front of a user: the drawer's payload, the
 * adapter, the 15.11 store and the PATCH body it produces. Both bugs were
 * invisible to the component in isolation and only showed up in the request --
 * so these assert on what goes over the wire, and on the rows that come back.
 *
 * The drawer and table are stubbed: what is under test is the wiring between
 * them and the store, not @gitlab/ui's rendering.
 */

jest.mock('~/lib/utils/axios_utils', () => ({ get: jest.fn(), patch: jest.fn() }))
jest.mock('~/api', () => ({ environments: jest.fn(() => Promise.resolve({ data: [] })) }))
jest.mock('oc_vue_shared/client_utils/oc-flash', () => jest.fn())

// Mocked as modules, not stubbed at mount: the real drawer imports lodash-es,
// which jest does not transform out of node_modules, and neither component's
// rendering is what these assert on.
jest.mock('./ci_variable_drawer.vue', () => ({
    name: 'CiVariableDrawer',
    props: ['areEnvironmentsLoading', 'areHiddenVariablesAvailable', 'areScopedVariablesAvailable',
        'environments', 'mode', 'selectedVariable'],
    render: () => null,
}))
jest.mock('./ci_variable_table.vue', () => ({ name: 'CiVariableTable', render: () => null }))

const DrawerStub = CiVariableDrawer
const TableStub = CiVariableTable

const ENDPOINT = '/jest/dashboard/-/variables'
const ENVIRONMENT = 'production'

// what the server hands back; environment_scope is filtered on by fetchVariables
const serverRows = (rows) => ({ data: { variables: rows } })

const row = (over = {}) => ({
    id: 11,
    key: 'DEPLOY_TOKEN',
    value: 'stored-value',
    variable_type: 'env_var',
    protected: false,
    masked: true,
    environment_scope: ENVIRONMENT,
    ...over,
})

function build() {
    const store = new Vuex.Store({
        modules: {
            ci_variables: {
                namespaced: true,
                ...asModule({ endpoint: ENDPOINT, environmentName: ENVIRONMENT, projectId: 1, isGroup: false }),
            },
        },
    })
    const wrapper = mount(CiVariableSettings, {
        props: { environmentName: ENVIRONMENT },
        global: { plugins: [store] },
    })
    return { wrapper, store }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))
const lastPatch = () => axios.patch.mock.calls.at(-1)[1].variables_attributes[0]

beforeEach(() => {
    // jest.config sets resetMocks, so factory implementations are wiped before
    // each test and have to be re-established here rather than at mock time.
    axios.get.mockResolvedValue(serverRows([row()]))
    axios.patch.mockResolvedValue({})
    Api.environments.mockResolvedValue({ data: [] })
})

describe('adding a variable', () => {
    it('sends a value the server will accept', async () => {
        const { wrapper } = build()
        wrapper.findComponent(TableStub).vm.$emit('add-variable')
        await wrapper.vm.$nextTick()

        wrapper.findComponent(DrawerStub).vm.$emit('add-variable', {
            key: 'NEW_KEY',
            value: 'new-value',
            protected: false,
            masked: true,
            environmentScope: ENVIRONMENT,
            variableType: variableTypes.envType,
        })
        await flush()

        expect(axios.patch).toHaveBeenCalledWith(ENDPOINT, expect.anything())
        // the bug that reached a user: no value in the body at all
        expect(lastPatch()).toMatchObject({
            key: 'NEW_KEY',
            value: 'new-value',
            secret_value: 'new-value',
            variable_type: 'env_var',
            environment_scope: ENVIRONMENT,
        })
    })

    // The drawer collects these and the server stores them; dropping them in the
    // adapter loses the user's input with no error shown.
    it('forwards the description the drawer collected', async () => {
        const { wrapper } = build()
        wrapper.findComponent(TableStub).vm.$emit('add-variable')
        await wrapper.vm.$nextTick()

        wrapper.findComponent(DrawerStub).vm.$emit('add-variable', {
            key: 'NEW_KEY', value: 'v', description: 'what this is for',
            environmentScope: ENVIRONMENT, variableType: variableTypes.envType,
        })
        await flush()

        expect(lastPatch().description).toBe('what this is for')
    })

    it('forwards the raw flag rather than always expanding references', async () => {
        const { wrapper } = build()
        wrapper.findComponent(TableStub).vm.$emit('add-variable')
        await wrapper.vm.$nextTick()

        wrapper.findComponent(DrawerStub).vm.$emit('add-variable', {
            key: 'NEW_KEY', value: '$OTHER', raw: false,
            environmentScope: ENVIRONMENT, variableType: variableTypes.envType,
        })
        await flush()

        expect(lastPatch().raw).toBe(false)
    })

    it('opens the drawer in add mode with no variable selected', async () => {
        const { wrapper } = build()
        wrapper.findComponent(TableStub).vm.$emit('add-variable')
        await wrapper.vm.$nextTick()

        const drawer = wrapper.findComponent(DrawerStub)
        expect(drawer.exists()).toBe(true)
        expect(drawer.props('mode')).toBe(ADD_VARIABLE_ACTION)
        expect(drawer.props('selectedVariable')).toEqual({})
    })

    it('refreshes the table from the server rather than trusting the form', async () => {
        const { wrapper, store } = build()
        wrapper.findComponent(TableStub).vm.$emit('add-variable')
        await wrapper.vm.$nextTick()

        axios.get.mockResolvedValue(serverRows([row(), row({ id: 12, key: 'NEW_KEY', value: 'new-value' })]))
        wrapper.findComponent(DrawerStub).vm.$emit('add-variable', {
            key: 'NEW_KEY', value: 'new-value', environmentScope: ENVIRONMENT,
            variableType: variableTypes.envType,
        })
        await flush()

        expect(store.state.ci_variables.variables.map((v) => v.key)).toEqual(['DEPLOY_TOKEN', 'NEW_KEY'])
    })

    it('closes the drawer once the write lands', async () => {
        const { wrapper } = build()
        wrapper.findComponent(TableStub).vm.$emit('add-variable')
        await wrapper.vm.$nextTick()
        wrapper.findComponent(DrawerStub).vm.$emit('add-variable', {
            key: 'K', value: 'v', environmentScope: ENVIRONMENT, variableType: variableTypes.envType,
        })
        await flush()
        await wrapper.vm.$nextTick()

        expect(wrapper.findComponent(DrawerStub).exists()).toBe(false)
    })
})

describe('editing a variable', () => {
    it('prefills the drawer from the stored row', async () => {
        const { wrapper } = build()
        wrapper.findComponent(TableStub).vm.$emit('edit-variable', row({ masked: true, protected: true }))
        await wrapper.vm.$nextTick()

        const drawer = wrapper.findComponent(DrawerStub)
        expect(drawer.props('mode')).toBe(EDIT_VARIABLE_ACTION)
        expect(drawer.props('selectedVariable')).toMatchObject({
            id: 11,
            key: 'DEPLOY_TOKEN',
            value: 'stored-value',
            masked: true,
            protected: true,
            environmentScope: ENVIRONMENT,
            variableType: variableTypes.envType,
        })
    })

    it('prefills description and raw from the stored row', async () => {
        const { wrapper } = build()
        wrapper.findComponent(TableStub).vm.$emit('edit-variable',
            row({ description: 'stored description', raw: false }))
        await wrapper.vm.$nextTick()

        expect(wrapper.findComponent(DrawerStub).props('selectedVariable')).toMatchObject({
            description: 'stored description',
            raw: false,
        })
    })

    it('patches the existing row rather than creating a second one', async () => {
        const { wrapper } = build()
        wrapper.findComponent(TableStub).vm.$emit('edit-variable', row())
        await wrapper.vm.$nextTick()

        wrapper.findComponent(DrawerStub).vm.$emit('update-variable', {
            id: 11, key: 'DEPLOY_TOKEN', value: 'changed', masked: true,
            environmentScope: ENVIRONMENT, variableType: variableTypes.envType,
        })
        await flush()

        expect(lastPatch()).toMatchObject({ id: 11, value: 'changed', secret_value: 'changed' })
    })

    it('reopens showing the latest value, not the one it was first given', async () => {
        const { wrapper } = build()
        wrapper.findComponent(TableStub).vm.$emit('edit-variable', row())
        await wrapper.vm.$nextTick()

        axios.get.mockResolvedValue(serverRows([row({ value: 'changed' })]))
        wrapper.findComponent(DrawerStub).vm.$emit('update-variable', {
            id: 11, key: 'DEPLOY_TOKEN', value: 'changed',
            environmentScope: ENVIRONMENT, variableType: variableTypes.envType,
        })
        await flush()
        await wrapper.vm.$nextTick()

        // second edit, from the refreshed row the table now holds
        const { variables } = wrapper.vm.$store.state.ci_variables
        wrapper.findComponent(TableStub).vm.$emit('edit-variable', variables[0])
        await wrapper.vm.$nextTick()

        expect(wrapper.findComponent(DrawerStub).props('selectedVariable')).toMatchObject({
            value: 'changed',
        })
    })

    it('maps a file variable to the display type the api layer converts', async () => {
        const { wrapper } = build()
        wrapper.findComponent(TableStub).vm.$emit('edit-variable', row({ variable_type: 'file' }))
        await wrapper.vm.$nextTick()
        expect(wrapper.findComponent(DrawerStub).props('selectedVariable').variableType)
            .toBe(variableTypes.fileType)

        wrapper.findComponent(DrawerStub).vm.$emit('update-variable', {
            id: 11, key: 'DEPLOY_TOKEN', value: 'v',
            environmentScope: ENVIRONMENT, variableType: variableTypes.fileType,
        })
        await flush()
        expect(lastPatch().variable_type).toBe('file')
    })
})

describe('deleting a variable', () => {
    it('sends the destroy flag for the row that was open', async () => {
        const { wrapper } = build()
        wrapper.findComponent(TableStub).vm.$emit('edit-variable', row())
        await wrapper.vm.$nextTick()

        wrapper.findComponent(DrawerStub).vm.$emit('delete-variable', {
            id: 11, key: 'DEPLOY_TOKEN', value: 'stored-value',
            environmentScope: ENVIRONMENT, variableType: variableTypes.envType,
        })
        await flush()

        expect(lastPatch()).toMatchObject({ id: 11, key: 'DEPLOY_TOKEN', _destroy: true })
    })

    it('leaves the table without the deleted row', async () => {
        const { wrapper, store } = build()
        wrapper.findComponent(TableStub).vm.$emit('edit-variable', row())
        await wrapper.vm.$nextTick()

        axios.get.mockResolvedValue(serverRows([]))
        wrapper.findComponent(DrawerStub).vm.$emit('delete-variable', {
            id: 11, key: 'DEPLOY_TOKEN', environmentScope: ENVIRONMENT,
            variableType: variableTypes.envType,
        })
        await flush()

        expect(store.state.ci_variables.variables).toEqual([])
    })
})

describe('the environment it reads variables for', () => {
    // The dataset that used to supply this is rendered once per page load, and
    // the environment page routes without reloading -- so a second environment
    // showed the first one's variables.
    it('takes the environment from the prop, not the store it was built with', async () => {
        const store = new Vuex.Store({
            modules: {
                ci_variables: {
                    namespaced: true,
                    ...asModule({ endpoint: ENDPOINT, environmentName: 'stale-from-page-load', projectId: 1 }),
                },
            },
        })
        mount(CiVariableSettings, { props: { environmentName: ENVIRONMENT }, global: { plugins: [store] } })
        await flush()

        expect(store.state.ci_variables.environmentName).toBe(ENVIRONMENT)
    })

    it('follows a route change to another environment', async () => {
        const { wrapper, store } = build()
        await wrapper.setProps({ environmentName: 'another-environment' })
        await flush()

        expect(store.state.ci_variables.environmentName).toBe('another-environment')
    })

    it('only returns rows scoped to the current environment', async () => {
        const { store } = build()
        axios.get.mockResolvedValue(serverRows([
            row({ id: 1, key: 'MINE' }),
            row({ id: 2, key: 'THEIRS', environment_scope: 'another-environment' }),
        ]))
        await store.dispatch('ci_variables/fetchVariables')
        await flush()

        expect(store.state.ci_variables.variables.map((v) => v.key)).toEqual(['MINE'])
    })
})

describe('what the table shows after a save', () => {
    // The row the table renders comes back from the server, so a flag the user
    // changed has to survive the whole round trip -- adapter, api shape, and the
    // display mapping -- not just reach the request.
    it('reflects a changed masked flag', async () => {
        const { wrapper, store } = build()
        wrapper.findComponent(TableStub).vm.$emit('edit-variable', row({ masked: false }))
        await wrapper.vm.$nextTick()

        axios.get.mockResolvedValue(serverRows([row({ masked: true })]))
        wrapper.findComponent(DrawerStub).vm.$emit('update-variable', {
            id: 11, key: 'DEPLOY_TOKEN', value: 'stored-value', masked: true,
            environmentScope: ENVIRONMENT, variableType: variableTypes.envType,
        })
        await flush()

        expect(lastPatch().masked).toBe('true')
        expect(store.state.ci_variables.variables[0].masked).toBe(true)
    })

    it('reflects a changed protected flag', async () => {
        const { wrapper, store } = build()
        wrapper.findComponent(TableStub).vm.$emit('edit-variable', row({ protected: false }))
        await wrapper.vm.$nextTick()

        axios.get.mockResolvedValue(serverRows([row({ protected: true })]))
        wrapper.findComponent(DrawerStub).vm.$emit('update-variable', {
            id: 11, key: 'DEPLOY_TOKEN', value: 'stored-value', protected: true,
            environmentScope: ENVIRONMENT, variableType: variableTypes.envType,
        })
        await flush()

        expect(lastPatch().protected).toBe('true')
        expect(store.state.ci_variables.variables[0].protected).toBe(true)
    })

    it('keeps the description on the row the table renders', async () => {
        const { store } = build()
        axios.get.mockResolvedValue(serverRows([row({ description: 'what this is for' })]))
        await store.dispatch('ci_variables/fetchVariables')
        await flush()

        expect(store.state.ci_variables.variables[0].description).toBe('what this is for')
    })
})

describe('the table', () => {
    it('renders the display type, not the api type', async () => {
        const { wrapper, store } = build()
        await store.dispatch('ci_variables/fetchVariables')
        await flush()
        expect(store.state.ci_variables.variables[0].variable_type).toBe(displayText.variableText)
    })
})
