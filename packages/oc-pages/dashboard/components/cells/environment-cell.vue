<script>
import * as routes from '../../router/constants'
import LogosCloud from '../../../project_overview/components/shared/logos_cloud.vue'
export default {
    components: { LogosCloud },
    props: {
        environment: Object
    },
    data() {
        return {routes}
    }
}
</script>
<template>
    <router-link :to="{name: routes.OC_DASHBOARD_ENVIRONMENTS, params: {name: environment.name}}">
        <div class="status-item">
            <logos-cloud :small=true :cloud="environment.primary_provider.type"/> 
                {{environment.name}}
        </div>
    </router-link>
</template>
<style scoped>
.status-item {
    display: flex;
    align-items: flex-end;
}
</style>
