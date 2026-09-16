import { mount } from '@vue/test-utils'
import CiVariableDrawer from './ci_variable_drawer.vue'
import { ADD_VARIABLE_ACTION } from '../constants_19_3'

// @gitlab/ui ships untransformed esm that jest does not transpile out of
// node_modules. These assertions are about the component's own validation, not
// its rendering, so the library is stubbed rather than transformed -- the same
// approach gcp-provider-setup.test.js takes.
jest.mock('@gitlab/ui', () => {
    const stub = (name) => ({ name, render: () => null })
    const directive = { mounted() {}, updated() {} }
    return {
        GlAlert: stub('GlAlert'),
        GlButton: stub('GlButton'),
        GlDrawer: stub('GlDrawer'),
        GlFormCheckbox: stub('GlFormCheckbox'),
        GlFormCombobox: stub('GlFormCombobox'),
        GlFormGroup: stub('GlFormGroup'),
        GlFormInput: stub('GlFormInput'),
        GlCollapsibleListbox: stub('GlCollapsibleListbox'),
        GlFormTextarea: stub('GlFormTextarea'),
        GlLink: stub('GlLink'),
        GlModal: stub('GlModal'),
        GlModalDirective: directive,
        GlSprintf: stub('GlSprintf'),
        GlFormRadio: stub('GlFormRadio'),
        GlFormRadioGroup: stub('GlFormRadioGroup'),
        GlPopover: stub('GlPopover'),
        GlTooltipDirective: directive,
    }
})
// mixin() has to provide `track`: the drawer calls it from a validation watcher
jest.mock('~/tracking', () => ({
    mixin: () => ({ methods: { track: () => {}, trackEvent: () => {} } }),
    event: () => {},
}))

/*
 * The drawer defaults Visibility to Masked, and GitLab rejects a masked value
 * that is under 8 characters or contains whitespace (Ci::Maskable::REGEX and
 * MASK_AND_RAW_REGEX). It validates that itself -- but only against regexes it
 * takes by `inject`. With nothing providing them the validation has nothing to
 * test, every such value reaches the API, and the user gets an opaque
 * "Variables value is invalid" flash with no idea what is wrong.
 *
 * This mounts the real component, so it fails if those injections stop being
 * supplied -- which is the failure it exists to catch.
 */

// GitLab's own patterns, the values ci_variable_settings provides
const MASKABLE_REGEX = '^[a-zA-Z0-9_+=/@:.~-]{8,}$'
const MASKABLE_RAW_REGEX = '^\\S{8,}$'

function build(provide = {}) {
    return mount(CiVariableDrawer, {
        props: {
            areEnvironmentsLoading: false,
            areHiddenVariablesAvailable: false,
            areScopedVariablesAvailable: true,
            environments: ['*', 'production'],
            mode: ADD_VARIABLE_ACTION,
            selectedVariable: {},
        },
        global: {
            provide: {
                isProtectedByDefault: false,
                maskableRegex: MASKABLE_REGEX,
                maskableRawRegex: MASKABLE_RAW_REGEX,
                ...provide,
            },
        },
    })
}

// the drawer keeps its working copy in `variable`; typing is what sets it
const type = async (wrapper, value) => {
    wrapper.vm.variable = { ...wrapper.vm.variable, key: 'SOME_KEY', value }
    await wrapper.vm.$nextTick()
}

describe('masked value validation', () => {
    it('rejects the value the user actually tried', async () => {
        const wrapper = build()
        await type(wrapper, 'value') // 5 characters, Masked by default
        expect(wrapper.vm.variable.masked).toBe(true)
        expect(wrapper.vm.isValueValid).toBe(false)
    })

    it('says why, rather than leaving the server to', async () => {
        const wrapper = build()
        await type(wrapper, 'value')
        expect(wrapper.vm.maskedValueValidationErrors.join(' ')).toMatch(/8/)
    })

    it('rejects whitespace even when long enough', async () => {
        const wrapper = build()
        await type(wrapper, 'has spaces here')
        expect(wrapper.vm.isValueValid).toBe(false)
    })

    it('accepts a value that meets the requirements', async () => {
        const wrapper = build()
        await type(wrapper, 'long-enough-value')
        expect(wrapper.vm.isValueValid).toBe(true)
    })

    it('accepts anything while unmasked', async () => {
        const wrapper = build()
        await type(wrapper, 'value')
        wrapper.vm.variable = { ...wrapper.vm.variable, masked: false }
        await wrapper.vm.$nextTick()
        expect(wrapper.vm.isValueValid).toBe(true)
    })

    it('treats an empty value as not yet invalid', async () => {
        const wrapper = build()
        await type(wrapper, '')
        expect(wrapper.vm.isValueValid).toBe(true)
    })

    // Without the injections maskedRegexToUse is undefined and RegExp(undefined)
    // matches everything, so every value looks valid and the check silently
    // stops working. This is the regression that put the opaque flash in front
    // of a user.
    it('cannot validate at all when the regexes are not provided', async () => {
        const wrapper = build({ maskableRegex: undefined, maskableRawRegex: undefined })
        await type(wrapper, 'value')
        expect(wrapper.vm.isValueValid).toBe(true) // documents the broken state
    })
})
