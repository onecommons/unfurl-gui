<script>
import {mapGetters} from 'vuex'
import {DetectIcon} from 'oc_vue_shared/components/oc'
import {GlBadge} from '@gitlab/ui'
import {Tooltip as ElTooltip} from 'element-ui'

export default {
    name: 'ImportLink',
    props: {
        card: Object
    },
    components: {
        DetectIcon,
        GlBadge,
        ElTooltip
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
    <gl-badge size="md" v-if="show">

        <a style="color: inherit; display: contents;" :href="deploymentLink" target="blank"><detect-icon :size="16" name="connected" /></a>
        <el-tooltip v-if="show" class="d-content">
            <template #content>
                Shared from <a class="inverted-link" target="_blank" :href="deploymentLink">{{deploymentTitle}}</a> in <a class="inverted-link" target="_blank" :href="environmentLink">{{environmentName}}</a>
            </template>
            <div class="ml-1">Shared</div>
        </el-tooltip>

    </gl-badge>


</template>
<style scoped>
.inverted-link {
    filter: invert(1) hue-rotate(180deg);
}

</style>
