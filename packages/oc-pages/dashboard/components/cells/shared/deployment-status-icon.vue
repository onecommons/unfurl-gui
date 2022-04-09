<script>
import StatusIcon from '../../../../vue_shared/components/oc/Status.vue'
import {GlIcon} from '@gitlab/ui'
import _ from 'lodash'
import {mapGetters} from 'vuex'
export default {
    components: {
        StatusIcon,
        GlIcon
    },
    props: {
        scope: Object
    },
    computed: {
        ...mapGetters(['deploymentItemDirect']),
        deploymentItem() {
            return this.deploymentItemDirect({
                environment: this.scope.item.context.environment,
                deployment: this.scope.item.context.deployment,
            })
        },
        statuses() { 
            return _.uniqBy(
                this.scope.item.context.deployment?.statuses || [],
                resource => resource?.status
            ) 
        },
        hasDeployPath() {
            return !!this.deploymentItem?.deployPath
        }
    },
}
</script>
<template>
<div class="d-flex">
    <div v-if="deploymentItem && (deploymentItem.isDeployed || deploymentItem.isUndeployed)" class="d-flex ml-2 mr-1 align-items-center">
        <StatusIcon :size="16" v-if="!statuses.length" :status="1" />
        <StatusIcon :size="16" :key="status.name" v-for="status in statuses" :status="status.status" />
    </div>
    <div v-else-if="deploymentItem.jobStatus" class="d-flex ml-2 mr-1 align-items-center">
        <gl-icon :aria-label="`Pipeline: ${deploymentItem.jobStatus}`" :title="`Pipeline: ${deploymentItem.jobStatus}`" :name="`status_${deploymentItem.jobStatus}`" :size="16" />
    </div>
    <div v-else-if="hasDeployPath" class="d-flex ml-2 mr-1 align-items-center">
        <gl-icon name="pencil-square" :size="16" />
    </div>
</div>
</template>
