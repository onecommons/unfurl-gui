import {shallowMount} from '@vue/test-utils'
import {h} from 'vue'
import Environment from './environment.vue'

// @gitlab/ui ships untransformed esm that jest does not transpile out of
// node_modules; stub whatever is asked for
jest.mock('@gitlab/ui', () => new Proxy({}, {
    get(_target, name) {
        if(typeof name != 'string') return undefined
        if(name == '__esModule') return true
        if(name.endsWith('Directive')) return {}
        const props = new Proxy({}, {get: () => ({validator: () => true})})
        return {name, props, render: () => null}
    },
}))

const ADD = 'Add External Resource'

// a compat-mode parent may hand over slot content as an array
const slot = (content, ...args) => typeof content == 'function' ? content(...args) : content

// renders the two places the page puts its add button
const DeploymentResources = {
    name: 'DeploymentResources',
    render() {
        return h('div', [
            h('div', {class: 'header-controls'}, slot(this.$slots['primary-controls'], {})),
            h('div', {class: 'footer-controls'}, slot(this.$slots['primary-controls-footer'])),
        ])
    },
}
const GlButton = {name: 'GlButton', render() { return h('button', slot(this.$slots.default)) }}

function mountEnvironment({isMobileLayout, userCanEdit, currentTab = 0}) {
    const getters = {
        isMobileLayout,
        userCanEdit,
        getCardsStacked: [],
        hasPreparedMutations: false,
        getVariables: () => [],
        getHomeProjectPath: 'org/dash',
        providerTypesForEnvironment: () => [],
    }
    const $store = {
        getters: new Proxy(getters, {has: () => true, get: (t, name) => name in t ? t[name] : () => null}),
        state: {},
        dispatch: jest.fn(),
        commit: jest.fn(),
    }
    return shallowMount(Environment, {
        data: () => ({currentTab}),
        global: {
            mocks: {$store, $route: {params: {name: 'aws'}, query: {}}, $router: {push: jest.fn()}},
            stubs: {DeploymentResources, GlButton, OcPropertiesList: true},
        },
    })
}

function addButtons(wrapper, where) {
    return wrapper.findAll(`.${where}-controls button`).filter(b => b.text().includes(ADD)).length
}

beforeEach(() => {
    jest.spyOn(Environment.methods, 'freshState').mockResolvedValue()
})

afterEach(() => jest.restoreAllMocks())

describe('the add external resource button', () => {
    it.each([
        ['desktop', 'header', false],
        ['mobile', 'footer', true],
    ])('sits in the %s layout\'s %s', (_layout, where, isMobileLayout) => {
        const wrapper = mountEnvironment({isMobileLayout, userCanEdit: true})
        expect(addButtons(wrapper, where)).toBe(1)
        expect(addButtons(wrapper, where == 'header' ? 'footer' : 'header')).toBe(0)
    })

    it.each([['desktop', false], ['mobile', true]])(
        'is not offered on %s to a user who cannot edit', (_layout, isMobileLayout) => {
            const wrapper = mountEnvironment({isMobileLayout, userCanEdit: false})
            expect(addButtons(wrapper, 'header') + addButtons(wrapper, 'footer')).toBe(0)
        })

    it.each([['desktop', false], ['mobile', true]])(
        'is not offered on %s outside the resources tab', (_layout, isMobileLayout) => {
            const wrapper = mountEnvironment({isMobileLayout, userCanEdit: true, currentTab: 1})
            expect(addButtons(wrapper, 'header') + addButtons(wrapper, 'footer')).toBe(0)
        })
})
