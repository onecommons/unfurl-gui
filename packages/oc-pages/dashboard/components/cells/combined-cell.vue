<script>
import * as routes from '../../router/constants'
import DeploymentStatusIcon from './shared/deployment-status-icon.vue'
import {mapGetters} from 'vuex'
import _ from 'lodash'
import DashboardRouterLink from "../../components/dashboard-router-link.vue"
import {withApplicationLinkTarget} from './mixins'

export default {
    components: { DeploymentStatusIcon, DashboardRouterLink },
    mixins: [withApplicationLinkTarget],
    props: {
        deployment: {
            type: Object,
            required: true
        },
        environment: {
            type: Object,
            required: true
        },
        application: {
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
            type: Object,
            required: true
        },
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
<div class="d-flex">
    <deployment-status-icon :scope="scope" width="40px"/>
    <div v-if="application" style="display: flex; flex-direction: column;" :class="{'hash-fragment': `#${deployment.name}` == $route.hash}">
        <dashboard-router-link :noRouter="noRouter" :href="noRouter? deploymentItem.viewableLink: deploymentItem.viewableTo">
            <b>{{deployment.title}}:</b>
        </dashboard-router-link>
        <a :href="applicationLinkTarget">
            ({{application.title}})
        </a>

    </div>
</div>
</template>
<style scoped>
.status-item {
    display: flex;
    align-items: center;
}
</style>
