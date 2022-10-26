<script>
import {mapGetters} from 'vuex'
import {DetectIcon} from 'oc_vue_shared/oc-components'
import {Tooltip as ElTooltip} from 'element-ui'

export default {
    name: 'ImportLink',
    props: {
        card: Object
    },
    components: {
        DetectIcon
    },
    computed: {
        ...mapGetters(['getHomeProjectPath', 'lookupDeployment']),
        split() {
            return this.card.name.split('__').filter(s => s)
        },
        environmentName() { return this.split[0] },
        deploymentName() { return this.split[1] },
        resourceName() { return this.split[2] },
        deployment() {
            return this.lookupDeployment(this.deploymentName, this.environmentName)
        },
        deploymentTitle() {
            return this.deployment?.title || this.deploymentName
        },
        deploymentLink() {
           return `/${this.getHomeProjectPath}/-/deployments/${this.environmentName}/${this.deploymentName}#${this.resourceName}`
        },
        environmentLink() {
            return `/${this.getHomeProjectPath}/-/environments/${this.environmentName}`
        },
        show() {
            return this.card?.imported && this.deploymentLink
        }
    }
}

</script>
<template>
    <el-tooltip v-if="show">
        <template #content>
            Shared from <a class="inverted-link" target="_blank" :href="deploymentLink">{{deploymentTitle}}</a> in <a class="inverted-link" target="_blank" :href="environmentLink">{{environmentName}}</a>
        </template>
        <div class="d-flex align-items-center">
            <a style="color: inherit; display: contents;" :href="deploymentLink" target="blank"><detect-icon :size="18" name="share" /></a>
        </div>
    </el-tooltip>

</template>
<style scoped>
.inverted-link {
    filter: invert(1) hue-rotate(180deg);
}

</style>
