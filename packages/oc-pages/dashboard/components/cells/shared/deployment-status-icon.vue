<script>
import StatusIcon from 'oc_vue_shared/components/oc/Status.vue'
import {GlIcon, GlButton, GlTooltipDirective} from '@gitlab/ui'
import _ from 'lodash'
import {mapGetters} from 'vuex'
export default {
    components: {
        StatusIcon,
        GlIcon,
        GlButton
    },
    props: {
        scope: Object,
        width: {
            type: String,
            default: '30px'
        }
    },
    computed: {
        ...mapGetters(['deploymentItemDirect']),
        deploymentItem() {
            return this.deploymentItemDirect({
                environment: this.scope.item.context.environment,
                deployment: this.deployment,
            })
        },
        deployment() {
            return this.scope.item.context.deployment
        },
        hasDeployPath() {
            return !!this.deploymentItem?.deployPath
        },
        consoleLink() {
            return this.deploymentItem?.consoleLink
        },
        jobStatus() {
            return this.deploymentItem?.jobStatus
        },
        isDraft() {
            return this.deploymentItem?.isDraft
        },
        title() {
            if(this.deployment.status) {
                return this.deployment.summary
            }
            else if(this.jobStatus) {
                return `Pipeline: ${this.jobStatus}`
            }
            else if(this.isDraft){
                return 'Draft'
            }
            return null
        },
        tooltipProps() {
            const result = { }
            if(this.title) result.title = this.title
            return result

        }
    },
}
</script>
<template>
<div class="d-flex justify-content-center align-items-center" :style="{width: width}" v-gl-tooltip.hover="title"  >
    <StatusIcon v-if="deployment.status || jobStatus == 'failed'" :size="16" :status="deployment.status || 3" no-tooltip/>
    <gl-button v-else-if="jobStatus" style="padding: 0" pill size="small" :href="consoleLink" category="tertiary" :icon="`status_${jobStatus}`" />
    <gl-icon v-else-if="hasDeployPath" name="pencil-square" :size="16" />
</div>
</template>
