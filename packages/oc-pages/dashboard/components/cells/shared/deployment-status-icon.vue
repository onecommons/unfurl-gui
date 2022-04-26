<script>
import StatusIcon from '../../../../vue_shared/components/oc/Status.vue'
import {GlIcon, GlButton, GlTooltipDirective} from '@gitlab/ui'
import _ from 'lodash'
import {mapGetters} from 'vuex'
export default {
    components: {
        StatusIcon,
        GlIcon,
        GlButton
    },
    directive: {
        GlTooltip: GlTooltipDirective
    },
    props: {
        scope: Object
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
        statuses() { 
            return _.uniqBy(
                this.scope.item.context.deployment?.statuses || [],
                resource => resource?.status
            ) 
        },
        hasDeployPath() {
            return !!this.deploymentItem?.deployPath
        },
        consoleLink() {
            return this.deploymentItem?.consoleLink
        }
    },
}
</script>
<template>
<div class="d-flex ml-2 mr-2">
    <div v-if="deploymentItem && (deploymentItem.isDeployed || deploymentItem.isUndeployed)" class="d-flex align-items-center justify-content-center">
        <StatusIcon v-if="deployment.status" :size="16" v-gl-tooltip.hover :status="deployment.status" :title="deployment.summary"/>
        <div v-else>
            <!-- maybe I should just get rid of this -->
            <StatusIcon :size="16" :key="status.name" v-for="status in statuses" :status="status.status" />
        </div>
    </div>
    <div v-else-if="deploymentItem && deploymentItem.jobStatus" class="d-flex align-items-center">
        <gl-button style="padding: 0" pill size="small" :href="consoleLink" category="tertiary" :icon="`status_${deploymentItem.jobStatus}`" :title="`Pipeline: ${deploymentItem.jobStatus}`" />

    </div>
    <div v-else-if="hasDeployPath" class="d-flex align-items-center justify-content-center">
        <gl-icon name="pencil-square" :size="16" />
    </div>
</div>
</template>
