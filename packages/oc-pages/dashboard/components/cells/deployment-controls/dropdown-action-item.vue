<script>
import {GlDisclosureDropdownItem} from '@gitlab/ui'

// control-buttons renders every action the same way -- `@click` and an optional
// `:href` -- because that was gl-dropdown-item's contract. GlDisclosureDropdownItem
// instead takes an `item` object and emits `action`, so this translates between
// them and leaves the seventeen call sites alone.
export default {
    name: 'DropdownActionItem',
    components: {GlDisclosureDropdownItem},
    props: {
        href: {type: String, default: undefined},
        disabled: {type: Boolean, default: false},
    },
    emits: ['click'],
    computed: {
        item() {
            // an href makes it render an <a>; the label comes from the slot, so
            // nothing else is read off `item`
            return {
                ...(this.href? {href: this.href}: {}),
                ...(this.disabled? {extraAttrs: {disabled: true}}: {}),
            }
        },
    },
}
</script>
<template>
    <gl-disclosure-dropdown-item :item="item" @action="$emit('click', $event)">
        <template #list-item><slot/></template>
    </gl-disclosure-dropdown-item>
</template>
