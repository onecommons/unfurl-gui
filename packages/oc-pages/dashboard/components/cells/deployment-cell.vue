<script>
import * as routes from '../../router/constants'
import DeploymentStatusIcon from './shared/deployment-status-icon.vue'
import {mapGetters} from 'vuex'
import _ from 'lodash'
import DashboardRouterLink from "../../components/dashboard-router-link.vue"

export default {
    components: { DeploymentStatusIcon, DashboardRouterLink },
    props: {
        deployment: {
            type: Object,
            required: true
        },
        environment: {
            type: Object,
            required: true
        },
        displayStatus: {
            type: Boolean,
            default: true
        },
        noRouter: {
            type: Boolean,
            default: false
        },
        scope: {
            type: Object, required: true
        }
    },
    data() {
        return {routes}
    },
    computed: {
        ...mapGetters(['deploymentItemDirect']),
        deploymentItem() {
            const {environment, deployment} = this
            const deploymentItem = this.deploymentItemDirect({environment, deployment})
            return deploymentItem
        },
        statuses() {
            return _.uniqBy(this.deployment.statuses || [], 'type')
        }
    }
}
</script>
<template>
<div class="d-flex align-items-center">
    <deployment-status-icon :scope="scope" />
    <dashboard-router-link :noRouter="noRouter" :href="noRouter? deploymentItem.viewableLink: deploymentItem.viewableTo">
        <div v-if="displayStatus && deployment" class="status-item">
            <div class="font-weight-bold" style="line-height: 0">{{deployment.title}}</div>
        </div> 
        <div v-else-if="deployment"> {{deployment.title}} </div>
    </dashboard-router-link>
</div>
</template>
<style scoped>
.status-item {
    display: flex;
    align-items: center;
}
</style>
