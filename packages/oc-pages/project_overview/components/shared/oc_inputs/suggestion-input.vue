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
    props: {
        value: {type: String, default: null},
        label: {type: String, required: true},
        fetchSuggestions: {type: Function, required: true},
        disabled: {type: Boolean, default: false},
        placeholder: {type: String, default: 'Type to search'}
    },
    data() {
        return {suggestions: []}
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
        <gl-form-input :value="value" disabled type="text"/>
    </gl-form-group>
    <gl-form-combobox
        v-else
        :value="value || ''"
        :label-text="label"
        :token-list="suggestions"
        :placeholder="placeholder"
        @input="onInput"
    />
</template>
