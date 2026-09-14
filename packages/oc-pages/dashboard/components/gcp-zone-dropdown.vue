<script>
import {GlCollapsibleListbox} from '@gitlab/ui'
import {ZONES} from './gcp-zones'

// 15.11's zone-dropdown.vue was built from ~/vue_shared/components/dropdown/*,
// which 19.3 deleted along with the cluster pages.
export default {
    name: 'GcpZoneDropdown',
    compatConfig: {MODE: 3, COMPONENT_V_MODEL: false},
    components: {GlCollapsibleListbox},
    props: {
        modelValue: {
            type: String,
            default: '',
        },
        disabled: {
            type: Boolean,
            default: false,
        },
        placeholder: {
            type: String,
            default: 'Select zone',
        },
    },
    emits: ['update:modelValue'],
    ZONE_ITEMS: ZONES.map(name => ({value: name, text: name})),
    computed: {
        toggleText() {
            return this.modelValue || this.placeholder
        },
    },
}
</script>
<template>
    <gl-collapsible-listbox
        data-testid="gcp-zone-dropdown"
        searchable
        search-placeholder="Search zones"
        :disabled="disabled"
        :items="$options.ZONE_ITEMS"
        :selected="modelValue"
        :toggle-text="toggleText"
        @select="$emit('update:modelValue', $event)"
    />
</template>
