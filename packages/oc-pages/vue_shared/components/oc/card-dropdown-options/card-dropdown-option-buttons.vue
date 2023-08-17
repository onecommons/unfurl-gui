<script>
import {GlIcon, GlButton, GlDropdown, GlDropdownItem} from '@gitlab/ui'

export default {
    name: 'CardDropdownOptionButtons',
    components: {GlIcon, GlButton, GlDropdown, GlDropdownItem, OpenLiveApp},
    props: {
        controlButtons: Array,
        card: Object,
        component: {
            type: [String, Object],
            default: () => 'gl-button'
        }
    }
}
</script>
<template>
<div class="control-button-container">
</div>
</template>
<style scoped>
.control-button-container >>> .gl-button-text {
    font-size: 0.95em;
    font-weight: 600;
    display: flex;
    align-items: center;
}
.control-button-container >>> .gl-button { width: 10.5em; padding: 0.2em 0; height: 100%;}
.control-button-container >>> .gl-new-dropdown-item-text-primary { display: flex; align-items: center; }
.control-button-container >>> .gl-icon { margin-right: 0.25em; }
.control-button-container >>> .disabled { opacity: 0.7; }
</style>
