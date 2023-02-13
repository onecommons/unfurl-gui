<script>
import * as routes from '../../router/constants'
import {mapGetters} from 'vuex'
import {DetectIcon} from 'oc_vue_shared/oc-components'
export default {
    components: { DetectIcon },
    props: {
        environment: Object,
        noRouter: {type: Boolean, default: false}
    },
    data() {
        return {routes}
    },
    computed: {
        ...mapGetters(['getHomeProjectPath']),
        destination() {
            return this.noRouter ?
                {href: `/${this.getHomeProjectPath}/-/environments/${this.$props?.environment?.name}`} :
                this.$router.resolve({name: routes.OC_DASHBOARD_ENVIRONMENTS, params: {name: this.$props?.environment?.name}})
        }
    }

}
</script>
<template>
    <a v-if="environment" :href="destination.href">
        <div class="status-item font-weight-bold">
            <detect-icon :size="20" v-if="environment.primary_provider" :type="environment.primary_provider.type"/> 
            <div class="ml-1">{{environment.name}}</div>
        </div>
    </a>
</template>
<style scoped>
.status-item {
    display: flex;
    align-items: center;
}
</style>
