<script>
import * as routes from '../../router/constants'
import StatusIcon from '../../../vue_shared/components/oc/Status.vue'
export default {
    components: { StatusIcon },
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
        }
    },
    data() {
        return {routes}
    },
    computed: {
        to() {
            const href = this.noRouter?
                `/dashboard/deployments/${this.environment.name}/${this.deployment.name}`: // TODO use from routes.js
                {name: routes.OC_DASHBOARD_DEPLOYMENTS, params: {name: this.deployment.name, environment: this.environment.name}}
            return this.noRouter? {href}: {to: href}
        }
    }
}
</script>
<template>
    <component :is="noRouter? 'a': 'router-link'" v-if="deployment && deployment.name" v-bind="to">
        <div v-if="displayStatus && deployment" class="status-item">
                <status-icon v-for="resource in deployment.statuses || []" :key="resource.name" :status="resource.status"/>
                <div class="font-weight-bold" style="margin-bottom: -2px;">{{deployment.title}}</div>
        </div>
        <div v-else-if="deployment">
            {{deployment.title}}
        </div>
    </component>
</template>
<style scoped>
.status-item {
    display: flex;
    align-items: flex-end;
}
</style>
