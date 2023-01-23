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
            const pollingStatus = this.pollingStatus(this.deployment?.url)
            return pollingStatus == 'PENDING'
        }

    }
}
</script>
<template>
    <component :is="component" :disabled="disabled" target="_blank" rel="noopener noreferrer" :href ="deployment.url" variant="confirm">

        <gl-loading-icon v-if="disabled" class="mr-1"/>
        <gl-icon v-else :size="16" name="external-link"/> 
        {{__('Open Live App')}}
    </component>
</template>
