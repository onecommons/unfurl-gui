<script>
import {mapGetters, mapActions} from 'vuex'
import {DetectIcon} from 'oc_vue_shared/oc-components'
import {generateGitLabIssueSync} from 'oc_vue_shared/client_utils/gitlab-issues'
import {GlDropdown, GlDropdownItem, GlDropdownDivider} from '@gitlab/ui'
export default {
    props: {
        card: Object
    },
    data () {
        try {
            return {openCloudPublish: JSON.parse(gon.openCloudPublish)}
        } catch(e) { return {openCloudPublish: null} }
    },
    components: {DetectIcon, GlDropdown, GlDropdownItem, GlDropdownDivider},
    computed: {
        ...mapGetters(['getCurrentEnvironment', 'getDeploymentTemplate', 'getResourceSharedState', 'getHomeProjectPath', 'resolveResourceTypeFromAny']),
        canShareResource() {
            /*
             * don't require connect implementation, handled by Unfurl
             * https://github.com/onecommons/gitlab-oc/issues/1167
            */
            // const type = this.resolveResourceTypeFromAny(this.card?.type)

            return (
                // type?.implementations?.includes('connect') &&
                this.card?.name &&
                !this.card.name.startsWith('__') && // __ prefix is a hack for unfurl-gui to track external resources
                this.card.status == 1
            )
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
                return `Shared in all environments.`
            }
            else if(this.sharedStatus == 'environment') {
                return `Shared in <b>${this.getCurrentEnvironment.name}</b>.`
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
        },
        sharePublic() {
            const {projectPath, title, description} = this.openCloudPublish


            const TEMPLATE_VARS = {
                'RESOURCE': this.card.title || this.card.name,
                'ENVIRONMENT': this.getCurrentEnvironment.name,
                'DEPLOYMENT': this.getDeploymentTemplate.name,
                'DASHBOARD': this.getHomeProjectPath,
            }

            function interpolateVars(s) {
                let result = s
                for(const [key, value] of Object.entries(TEMPLATE_VARS)) {
                    const regexpTemplate = `\\$${key}`
                    result = result.replace(new RegExp(regexpTemplate, 'g'), value)
                }

                return result
            }

            const issueLink = generateGitLabIssueSync(projectPath, {title: interpolateVars(title), description: interpolateVars(description)})

            window.open(issueLink, '_blank')

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
            <div class="d-inline-flex">Share in current environment</div>
        </gl-dropdown-item>
        <gl-dropdown-item v-if="sharedStatus != 'dashboard'" @click="shareWithDashboard">Share with all environments</gl-dropdown-item>
        <gl-dropdown-item v-if="openCloudPublish" @click="sharePublic">Share publically</gl-dropdown-item>
        <gl-dropdown-item v-if="sharedStatus" @click="stopSharing">Stop sharing <b>{{card.title}}</b></gl-dropdown-item>
    </gl-dropdown>
</template>
