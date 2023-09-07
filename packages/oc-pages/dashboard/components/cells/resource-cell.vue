<script>
import {mapGetters} from 'vuex'
import * as routes from '../../router/constants'
import StatusIcon from 'oc_vue_shared/components/oc/Status.vue';
import {generateCardId} from 'oc_vue_shared/util'
import DashboardRouterLink from "../../components/dashboard-router-link.vue"

export default {
    components: { StatusIcon, DashboardRouterLink },
    props: {
        resource: Object, deployment: Object, environment: Object,
        noRouter: {
            type: Boolean,
            default: false
        }

    },
    data() {
        return {}
        //return {routes}
    },
    computed: {
        ...mapGetters(['getHomeProjectPath', 'deploymentItemDirect']),
        id() {
            return generateCardId(this.resource.name)
        },
        deploymentItem() {
            const {environment, deployment} = this
            const deploymentItem = this.deploymentItemDirect({environment, deployment})
            return deploymentItem
        },
        to() {
            const href = this.noRouter?
            `${this.deploymentItem.viewableLink}#${this.id}`:
                {name: routes.OC_DASHBOARD_DEPLOYMENTS, params: {name: this.deployment.name, environment: this.environment.name}, hash: `#${this.id}`}
            return this.noRouter ? href : {to: href}
        },
    }
}
</script>
<template>
    <dashboard-router-link :noRouter="noRouter" :href="to">
        <div v-if="resource" class="status-item">
            <status-icon :size="16" :status="resource.status" :isProtected="resource['protected']" class="mr-1"/>
            <div style="line-height: 0">{{resource.title}}</div>
        </div>
    </dashboard-router-link>
</template>
<style scoped>
.status-item {
    display: flex;
    align-items: center;
}
</style>
