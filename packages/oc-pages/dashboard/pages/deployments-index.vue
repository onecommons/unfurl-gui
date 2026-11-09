<script lang="ts">
import {defineComponent} from 'vue'
import DeploymentsIndexTable from '../components/tables/deployment-index-table.vue'
import DashboardBreadcrumbs from '../components/dashboard-breadcrumbs.vue'
import {mapGetters} from 'vuex'
import * as routes from '../router/constants'
import {__} from '~/locale'


export default defineComponent({
    components: {DashboardBreadcrumbs, DeploymentsIndexTable},
    data() {
        const query = this.$route.query
        const show = query?.show
        const breadcrumbItems = [
            {text: __('Deployments'), href: '#'}
        ]

        return {
            routes,
            breadcrumbItems
        }
    },
    computed: {
        ...mapGetters([
            'getDashboardItems',
        ]),
        deployments() {
            return this.getDashboardItems.filter((item: Record<string, any>) => item.deployment)
        }
    }
})

</script>
<template>
    <div data-testid="dashboard-deployments-page">
      <dashboard-breadcrumbs :items="breadcrumbItems" />
      <deployments-index-table tabs :items="deployments"/>
    </div>
</template>
