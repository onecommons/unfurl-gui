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
    },
    computed: {
        destination() {
            return this.$router.resolve({name: routes.OC_DASHBOARD_ENVIRONMENTS, params: {name: this.$props?.environment?.name}})
        }
    }

}
</script>
<template>
    <a v-if="environment" :href="destination.href">
        <div class="status-item">
            <logos-cloud v-if="environment.primary_provider" :small=true :cloud="environment.primary_provider.type"/> 
            {{environment.name}}
        </div>
    </a>
</template>
<style scoped>
.status-item {
    display: flex;
    align-items: flex-end;
}
</style>
