<script>
import {GlCollapsibleListbox} from '@gitlab/ui'
import {ZONES} from './gcp-zones'

// 15.11's zone-dropdown.vue was built from ~/vue_shared/components/dropdown/*,
// which 19.3 deleted along with the cluster pages.
//
// Callers must bind :model-value / @update:modelValue explicitly rather than
// v-model: under @vue/compat the sugar reaches a MODE 3 child's inbound
// modelValue prop as something this never receives, so the update is dropped
// silently. jest does not reproduce it -- @vue/vue3-jest compiles v-model
// differently from the build's compiler -- so only a real page catches it.
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
    data() {
        return {searchTerm: ''}
    },
    computed: {
        toggleText() {
            return this.modelValue || this.placeholder
        },
        // `searchable` only renders the box and emits the term -- filtering the
        // list is the consumer's job
        filteredItems() {
            const term = this.searchTerm.trim().toLowerCase()
            if(!term) return this.$options.ZONE_ITEMS
            return this.$options.ZONE_ITEMS.filter(item => item.value.includes(term))
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
        :items="filteredItems"
        :selected="modelValue"
        :toggle-text="toggleText"
        @search="searchTerm = $event"
        @select="$emit('update:modelValue', $event)"
    />
</template>
