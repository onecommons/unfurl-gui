import {shallowMount} from '@vue/test-utils'
import Vuex from 'vuex'
import Autostop from './autostop.vue'
import AutostopInner from './autostop-inner.vue'

// @gitlab/ui ships untransformed esm that jest does not transpile out of
// node_modules; shallowMount stubs these anyway
jest.mock('@gitlab/ui', () => new Proxy({}, {
    get(_target, name) {
        if(typeof name != 'string') return undefined
        if(name == '__esModule') return true
        if(name.endsWith('Directive')) return {}

        const props = new Proxy({}, {get: () => ({validator: () => true})})

        return {name, props, render: () => null}
    },
}))

const setAutostop = jest.fn()
const store = new Vuex.Store({mutations: {setAutostop}})

// autostop-inner sits in the popover's slot, which a plain stub drops. A render
// function rather than a template, because the runtime build has no compiler,
// and compat hands Vue 2 slots over as vnode arrays rather than functions.
const GlPopover = {
    render() {
        const slot = this.$slots.default

        return typeof slot == 'function' ? slot() : slot
    },
}

function mountAutostop() {
    return shallowMount(Autostop, {
        global: {plugins: [store], mocks: {__: s => s}, stubs: {GlPopover}},
    })
}

describe('autostop', () => {
    beforeEach(() => setAutostop.mockClear())

    // autostop-inner is on the Vue 3 emit contract, so a caller's `v-model`
    // compiles to a compat listener it never fires: the emit is dropped and
    // the schedule silently stays empty.
    it('takes the value autostop-inner emits', async () => {
        const wrapper = mountAutostop()

        wrapper.findComponent(AutostopInner).vm.$emit('update:modelValue', 3600)
        await wrapper.vm.$nextTick()

        expect(wrapper.vm.autostop).toBe(3600)
    })

    it('pushes the scheduled value to the store once enabled', async () => {
        const wrapper = mountAutostop()

        wrapper.vm.enabledAutostop = true
        wrapper.findComponent(AutostopInner).vm.$emit('update:modelValue', 7200)
        await wrapper.vm.$nextTick()

        expect(setAutostop).toHaveBeenCalledWith(expect.anything(), 7200)
    })
})
