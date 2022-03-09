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
        }
    },
    data() {
        return {routes}
    }
}
</script>
<template>
    <!--router-link v-if="deployment && deployment.name" :to="{name: routes.OC_DASHBOARD_DEPLOYMENTS, params: {name: deployment.name, environment: environment.name}}"-->
    <a :href="deployment.url || '#'" rel="noreferrer noopener" target="_blank">
        <div v-if="displayStatus" class="status-item">
                <status-icon v-for="resource in deployment.statuses" :key="resource.name" :status="resource.status"/>
                <div style="margin-bottom: -2px;">{{deployment.title}}</div>
        </div>
        <div v-else>
            {{deployment.title}}
        </div>
    </a>
    <!--/router-link-->
</template>
<style scoped>
.status-item {
    display: flex;
    align-items: flex-end;
}
</style>
