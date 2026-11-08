import {shallowMount, flushPromises} from '@vue/test-utils'
import Vuex from 'vuex'
import ImportButton from './import-button.vue'

jest.mock('@gitlab/ui', () => ({GlButton: {name: 'GlButton', render: () => null}}))

const mountWith = (pollPromise) => {
    const repoImport = {
        importStatus: 1, // AVAILABLE
        importSelf: jest.fn(async () => { repoImport.pollPromise = pollPromise }),
    }
    const store = new Vuex.Store({getters: {getCurrentNamespace: () => 'my-group'}})
    const wrapper = shallowMount(ImportButton, {props: {repoImport}, global: {plugins: [store]}})
    return {wrapper, repoImport}
}

describe('import-button', () => {
    it('emits importFinished once the import finishes', async () => {
        const {wrapper, repoImport} = mountWith(Promise.resolve(true))

        await wrapper.vm.dispatchClick()
        await flushPromises()

        expect(repoImport.importSelf).toHaveBeenCalledWith('my-group')
        expect(wrapper.emitted('startImport')).toHaveLength(1)
        expect(wrapper.emitted('importFinished')).toHaveLength(1)
    })

    it('does not emit for a poll a newer one replaced', async () => {
        const {wrapper} = mountWith(Promise.resolve(false))

        await wrapper.vm.dispatchClick()
        await flushPromises()

        expect(wrapper.emitted('importFinished')).toBeUndefined()
    })

    it('logs a failed poll instead of leaving the rejection unhandled', async () => {
        const error = jest.spyOn(console, 'error').mockImplementation(() => {})
        const failure = new Error('Network Error')
        const {wrapper} = mountWith(Promise.reject(failure))

        await wrapper.vm.dispatchClick()
        await flushPromises()

        expect(error).toHaveBeenCalledWith(failure)
        expect(wrapper.emitted('importFinished')).toBeUndefined()
        error.mockRestore()
    })
})
