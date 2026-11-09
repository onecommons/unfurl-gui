<script lang="ts">
import {defineComponent} from 'vue'
import {mapGetters, mapActions} from 'vuex'
import {DetectIcon} from 'oc_vue_shared/components/oc'
import {generateGitLabIssueSync} from 'oc_vue_shared/client_utils/gitlab-issues'
import {GlDropdown, GlDropdownItem, GlDropdownDivider} from '@gitlab/ui'

// TODO make this a global thing so it can apply to other operations
// Share actions run one at a time, each after the last has settled -- failed
// or not, so one refused update does not hold up every later one.
let queue: Promise<unknown> = Promise.resolve()

function serially<T>(task: () => Promise<T>): Promise<T> {
    const result = queue.then(task)
    queue = result.catch(() => {})
    return result
}

export default defineComponent({
    props: {
        card: {type: Object, required: true}
    },
    data () {
        const setting = gon.openCloudPublish
        if(!setting) return {openCloudPublish: null}
        try {
            return {openCloudPublish: JSON.parse(setting)}
        } catch(e) { return {openCloudPublish: null} }
    },
    components: {DetectIcon, GlDropdown, GlDropdownItem, GlDropdownDivider},
    computed: {
        ...mapGetters(['getCurrentEnvironment', 'getDeploymentTemplate', 'getResourceSharedState', 'getHomeProjectPath', 'resolveResourceTypeFromAny', 'userCanEdit']),
        canShareResource() {
            /*
             * don't require connect implementation, handled by Unfurl
             * https://github.com/onecommons/gitlab-oc/issues/1167
            */
            // const type = this.resolveResourceTypeFromAny(this.card?.type)
            if(!this.card) return false

            return (
                // type?.implementations?.includes('connect') &&
                this.userCanEdit &&
                this.card.name &&
                !(this.card.status == 3 || this.card?.status == 5) && // status is not error or absent
                this.card.__typename != 'ResourceTemplate' &&
                !this.card._external
                // && this.card.status == 1 // require OK status
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
        ...mapActions(['updateResourceSharedState', 'unshareResource', 'loadDashboard']),
        async shareWithEnvironment() {
            const
                environmentName = this.getCurrentEnvironment.name,
                deploymentName = this.getDeploymentTemplate.name,
                resourceName = this.card.name,
                shareState = 'environment'

            return serially(async () => {
                await this.updateResourceSharedState({environmentName, deploymentName, resourceName, shareState})
                await this.loadDashboard()
            })
        },
        async shareWithDashboard() {
            const
                environmentName = this.getCurrentEnvironment.name,
                deploymentName = this.getDeploymentTemplate.name,
                resourceName = this.card.name,
                shareState = 'dashboard'

            return serially(async () => {
                await this.updateResourceSharedState({environmentName, deploymentName, resourceName, shareState})
                await this.loadDashboard()
            })
        },
        async stopSharing() {
            const
                environmentName = this.getCurrentEnvironment.name,
                deploymentName = this.getDeploymentTemplate.name,
                resourceName = this.card.name

            return serially(async () => {
                await this.unshareResource({environmentName, deploymentName, resourceName})
                await this.loadDashboard()
            })
        },
        sharePublic() {
            const {projectPath, title, description} = this.openCloudPublish


            const TEMPLATE_VARS = {
                'RESOURCE': this.card.title || this.card.name,
                'ENVIRONMENT': this.getCurrentEnvironment.name,
                'DEPLOYMENT': this.getDeploymentTemplate.name,
                'DASHBOARD': this.getHomeProjectPath,
            }

            function interpolateVars(s: string) {
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
})

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
            <div class="gl-flex gl-items-center">
                <detect-icon name="share" :size="18" /> <span>{{dropdownText}}</span>
            </div>
        </template>
        <gl-dropdown-item v-if="sharedStatus != 'environment'" @click="shareWithEnvironment">
            <div class="gl-inline-flex">Share in current environment</div>
        </gl-dropdown-item>
        <gl-dropdown-item v-if="sharedStatus != 'dashboard'" @click="shareWithDashboard">Share with all environments</gl-dropdown-item>
        <gl-dropdown-item v-if="openCloudPublish" @click="sharePublic">Share publicly</gl-dropdown-item>
        <gl-dropdown-item v-if="sharedStatus" @click="stopSharing">Stop sharing <b>{{card.title}}</b></gl-dropdown-item>
    </gl-dropdown>
</template>
