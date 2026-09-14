<script>
/*
 * The el-autocomplete replacement for the four fork-only inputs.
 *
 * GlFormCombobox is the closest @gitlab/ui equivalent, but it filters a
 * `tokenList` it is given rather than calling out for suggestions, and it has
 * no `disabled` prop -- it does not set inheritAttrs, so a disabled attribute
 * would land on the wrapping div and do nothing. Both gaps are closed here
 * once instead of at each of the six call sites.
 *
 * `fetchSuggestions` keeps element-ui's `(query, callback)` signature, so the
 * methods behind it did not have to change: they already filter by the query,
 * which matters because GlFormCombobox's tokenList watcher opens the dropdown
 * on whatever list it is handed, unfiltered.
 *
 * It is called as a prop, so `this` inside it is only the parent because Vue
 * binds `methods` to their instance. Pass a bound method, not an inline arrow
 * or an unbound function.
 */
import {GlFormCombobox, GlFormGroup, GlFormInput} from '@gitlab/ui'

export default {
    name: 'SuggestionInput',
    components: {GlFormCombobox, GlFormGroup, GlFormInput},
    // MODE 3 and modelValue are one change: @vue/compat rewrites modelValue
    // back to value for any component still in MODE 2, so a component cannot
    // move to the Vue 3 v-model contract on its own. Callers keep v-model.
    compatConfig: {MODE: 3, COMPONENT_V_MODEL: false},
    emits: ['update:modelValue', 'input'],
    /*
     * Callers are in global compat mode, so their `v-model` compiles to the
     * Vue 2 contract and arrives as a plain `value` -- not the `modelValue`
     * declared below. Undeclared, it fell through to the root element, which
     * is the combobox, and overrode the guarded `:value` binding. A null then
     * reaches GlFormCombobox, whose `value` is `required` and read as
     * `value.length`, and the render throws. Declaring it as a prop is what
     * takes it out of $attrs -- the call sites' data-testid, class and style
     * still have to reach the root, so this must not set inheritAttrs.
     */
    props: {
        modelValue: {type: String, default: null},
        value: {type: String, default: undefined},
        label: {type: String, required: true},
        fetchSuggestions: {type: Function, required: true},
        disabled: {type: Boolean, default: false},
        placeholder: {type: String, default: 'Type to search'}
    },
    data() {
        return {suggestions: []}
    },
    computed: {
        // whichever contract the caller's v-model compiled to
        currentValue() {
            return this.value ?? this.modelValue ?? ''
        },
    },
    methods: {
        load(query) {
            this.fetchSuggestions(query || '', items => {
                this.suggestions = (items || [])
                    .map(item => (item && typeof item == 'object' ? item.value : item))
                    .filter(value => typeof value == 'string')
            })
        },
        onInput(value) {
            this.$emit('update:modelValue', value)
            // the Vue 2 contract the compat remap listens for
            this.$emit('input', value)
            /*
             * Not loaded on mount: a non-empty value plus a populated
             * tokenList is exactly the state GlFormCombobox renders expanded,
             * so a preload would leave every prefilled field with its dropdown
             * hanging open.
             */
            this.load(value)
        }
    }
}
</script>
<template>
    <gl-form-group v-if="disabled" :label="label">
        <gl-form-input :value="currentValue" disabled type="text"/>
    </gl-form-group>
    <gl-form-combobox
        v-else
        :value="currentValue"
        :label-text="label"
        :token-list="suggestions"
        :placeholder="placeholder"
        @input="onInput"
    />
</template>
