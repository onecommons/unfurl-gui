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
        const currentTab = (
            show == 'running' ? 1:
            show == 'stopped' ? 2:
            0
        )
        
        const breadcrumbItems = [
            {text: __('Deployments'), href: '#'}
        ]

        return {
            currentTab,
            routes,
            breadcrumbItems
        }
    },
    computed: {
        ...mapGetters([
            'getDashboardItems',
            'runningDeploymentsCount',
            'stoppedDeploymentsCount'
        ]),
        deploymentsCount() {
            return this.runningDeploymentsCount + this.stoppedDeploymentsCount
        },
        runningDeployments() {
            return this.getDashboardItems.filter(item => item.deployment && !item.deployment.isStopped)
        },
        stoppedDeployments() {
            return this.getDashboardItems.filter(item => item.deployment && item.deployment.isStopped)
        },
        deployments() {
            return this.getDashboardItems.filter(item => item.deployment)
        }
    },
    watch: {
        currentTab(value) {
            const path = this.$route.path
            const show = (
                value == 1 ? 'running':
                value == 2 ? 'stopped':
                undefined
            )
            const query = {show}
            this.$router.replace({path, query})
            
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
