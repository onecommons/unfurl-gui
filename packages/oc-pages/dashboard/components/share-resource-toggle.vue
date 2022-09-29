<script>
import {mapGetters, mapActions} from 'vuex'
import {DetectIcon} from 'oc_vue_shared/oc-components'
import {GlDropdown, GlDropdownItem, GlDropdownDivider} from '@gitlab/ui'
export default {
    props: {
        card: Object
    },
    components: {DetectIcon, GlDropdown, GlDropdownItem, GlDropdownDivider},
    computed: {
        ...mapGetters(['getCurrentEnvironment', 'getDeploymentTemplate', 'getResourceSharedState', 'getHomeProjectPath']),
        canShareResource() {
            return this.card?.name && !this.card.name.startsWith('__')
        },
        sharedStatus() {
            return this.getResourceSharedState(this.getCurrentEnvironment.name,  this.getDeploymentTemplate.name, this.card.name)
        },
        dropdownText() {
            if( this.sharedStatus ) {
                return 'Shared'
            }
            return 'Share'
        },
        sharedWithText() {
            if(this.sharedStatus == 'dashboard') {
                return `Currently shared with deployments in all dashboard environments.`
            }
            else if(this.sharedStatus == 'environment') {
                return `Currently shared with deployments in <b>${this.getCurrentEnvironment.name}</b>.`
            }
            return ''
        }
    },
    methods: {
        ...mapActions(['updateResourceSharedState', 'unshareResource']),
        shareWithEnvironment() {
            const 
                environmentName = this.getCurrentEnvironment.name,
                deploymentName = this.getDeploymentTemplate.name,
                resourceName = this.card.name,
                shareState = 'environment'
        
            this.updateResourceSharedState({environmentName, deploymentName, resourceName, shareState})
        },
        shareWithDashboard() {
            const 
                environmentName = this.getCurrentEnvironment.name,
                deploymentName = this.getDeploymentTemplate.name,
                resourceName = this.card.name,
                shareState = 'dashboard'

            this.updateResourceSharedState({environmentName, deploymentName, resourceName, shareState})
        },
        stopSharing() {
            const 
                environmentName = this.getCurrentEnvironment.name,
                deploymentName = this.getDeploymentTemplate.name,
                resourceName = this.card.name

            this.unshareResource({environmentName, deploymentName, resourceName})
        }
    }
}

</script>
<template>

    <gl-dropdown v-if="canShareResource" style="margin: 0 -0.5em;" toggle-class="text-decoration-none" no-caret right :popper-opts="{ positionFixed: true }">
        <template #header v-if="sharedStatus">
            <div>
                <div style="padding: 0 1rem" v-html="sharedWithText" />
                <gl-dropdown-divider />
            </div>
        </template>
        <template #button-content>
            <div class="d-flex">
                <detect-icon name="share" :size="18" /> <span>{{dropdownText}}</span>
            </div>
        </template>
        <gl-dropdown-item v-if="sharedStatus != 'environment'" @click="shareWithEnvironment">
            <div class="d-inline-flex">Share with deployments in only the current environment</div>
        </gl-dropdown-item>
        <gl-dropdown-item v-if="sharedStatus != 'dashboard'" @click="shareWithDashboard">Share with all environments in the current dashboard</gl-dropdown-item>
        <gl-dropdown-item v-if="sharedStatus" @click="stopSharing">Stop sharing <b>{{card.title}}</b></gl-dropdown-item>
    </gl-dropdown>
</template>
