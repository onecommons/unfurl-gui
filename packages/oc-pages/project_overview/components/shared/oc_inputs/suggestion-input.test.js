import {shallowMount} from '@vue/test-utils'
import SuggestionInput from './suggestion-input.vue'

// @gitlab/ui ships untransformed esm that jest does not transpile out of
// node_modules; shallowMount stubs these anyway
jest.mock('@gitlab/ui', () => new Proxy({}, {
    get(_target, name) {
        if(typeof name != 'string') return undefined
        if(name == '__esModule') return true

        const props = new Proxy({}, {get: () => ({validator: () => true})})

        return {name, props, render: () => null}
    },
}))

const PROJECTS = ['onecommons/support', 'onecommons/ci', 'root/dashboard']

function fetchSuggestions(query, callback) {
    callback(PROJECTS.filter(p => p.includes(query)).map(value => ({value})))
}

function mountInput(attrs = {}) {
    return shallowMount(SuggestionInput, {
        props: {label: 'Local Project', fetchSuggestions},
        attrs,
        global: {mocks: {__: s => s}},
    })
}

describe('suggestion-input', () => {
    // A caller's `v-model` compiles to this listener, not to `onInput`, and
    // $emit only reaches it while COMPONENT_V_MODEL compat is enabled. With it
    // off the emit went nowhere, so `value` stayed null and GlFormCombobox --
    // which gates the dropdown on `value.length > 0` -- never opened.
    it('reaches a caller that binds with v-model', () => {
        const onModelCompat = jest.fn()
        const wrapper = mountInput({'onModelCompat:input': onModelCompat})

        wrapper.vm.onInput('one')

        expect(onModelCompat).toHaveBeenCalledWith('one')
    })

    it('reaches a caller that binds the Vue 3 contract', () => {
        const wrapper = mountInput()

        wrapper.vm.onInput('one')

        expect(wrapper.emitted('update:modelValue')).toEqual([['one']])
    })

    it('loads suggestions for what was typed', () => {
        const wrapper = mountInput()

        wrapper.vm.onInput('one')

        expect(wrapper.vm.suggestions).toEqual(['onecommons/support', 'onecommons/ci'])
    })

    it('prefers whichever v-model contract the caller used', async () => {
        expect(mountInput().vm.currentValue).toEqual('')

        const v2 = shallowMount(SuggestionInput, {
            props: {label: 'l', fetchSuggestions, value: 'onecommons/ci'},
            global: {mocks: {__: s => s}},
        })
        expect(v2.vm.currentValue).toEqual('onecommons/ci')
    })
})
