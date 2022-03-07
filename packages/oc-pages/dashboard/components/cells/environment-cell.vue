<script>
import * as routes from '../../router/constants'
import {DetectIcon} from '../../../vue_shared/oc-components'
export default {
    components: { DetectIcon },
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
            <detect-icon v-if="environment.primary_provider" :type="environment.primary_provider.type"/> 
            <span class="ml-1">{{environment.name}}</span>
        </div>
    </a>
</template>
<style scoped>
.status-item {
    display: flex;
    align-items: center;
}
</style>
