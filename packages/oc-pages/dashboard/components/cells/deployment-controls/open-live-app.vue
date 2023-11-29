<script>
import {mapGetters} from 'vuex'
import {GlIcon, GlButton, GlDropdownItem, GlLoadingIcon} from '@gitlab/ui'
export default {
    name: 'OpenLiveApp',
    components: {GlIcon, GlButton, GlDropdownItem, GlLoadingIcon},
    props: {
        component: {
            type: [String, Object],
            default: () => 'gl-button'
        },
        deployment: Object,
    },
    computed: {
        ...mapGetters(['pollingStatus']),
        disabled() {
            if(typeof this.pollingStatus != 'function') return false
            const pollingStatus = this.pollingStatus(this.deployment?.name)
            return pollingStatus == 'PENDING'
        },
        title() {
            if(this.disabled) {
                return 'Application is not currently reachable'
            }
        }
    }
}
</script>
<template>
    <component :is="component" v-gl-tooltip.hover :title="title" :disabled="disabled" target="_blank" rel="noopener noreferrer" :href ="deployment.url" variant="confirm">

        <gl-loading-icon v-if="disabled && component != 'gl-dropdown-item'" class="mr-1"/>
        <gl-icon v-else :size="16" name="external-link"/>
        {{__('Open Live App')}}
    </component>
</template>
