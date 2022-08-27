<script>
import DeploymentsIndexTable from '../components/tables/deployment-index-table.vue'
import DashboardBreadcrumbs from '../components/dashboard-breadcrumbs.vue'
import {mapGetters} from 'vuex'
import * as routes from '../router/constants'
import {__} from '~/locale'


export default {
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
            return this.getDashboardItems.filter(item => item.deployment)
        }
    }
}

</script>
<template>
    <div>
      <dashboard-breadcrumbs :items="breadcrumbItems" />
      <deployments-index-table tabs :items="deployments"/>
    </div>
</template>
