<script>
import {GlIcon, GlTabs, GlBreadcrumb} from '@gitlab/ui'
import OcTab from '../../vue_shared/components/oc/oc-tab.vue'
import DeploymentsIndexTable from '../components/tables/deployment-index-table.vue'
import {mapGetters} from 'vuex'
import * as routes from '../router/constants'
import {__} from '~/locale.js'


export default {
    components: {GlIcon, GlTabs, GlBreadcrumb, OcTab, DeploymentsIndexTable},
    data() {
        const query = this.$route.query
        const show = query?.show
        const currentTab = (
            show == 'running' ? 1:
            show == 'stopped' ? 2:
            0
        )
        
        const breadcrumbItems = [
            {text: __('Dashboard'), to: {name: routes.OC_DASHBOARD_HOME, query: {}}},
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
            return this.getDashboardItems.filter(item => !item.deployment.isStopped)
        },
        stoppedDeployments() {
            return this.getDashboardItems.filter(item => item.deployment.isStopped)
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
        <gl-breadcrumb :items="breadcrumbItems">
            <template #separator>
                <gl-icon name="chevron-right" />
            </template>
        </gl-breadcrumb>
    <gl-tabs v-model="currentTab">
        <oc-tab title="All" :titleCount="deploymentsCount">
            <deployments-index-table :items="getDashboardItems"/>
        </oc-tab>
        <oc-tab title="Running" :titleCount="runningDeploymentsCount">
            <deployments-index-table :items="runningDeployments"/>
        </oc-tab>
        <oc-tab title="Stopped" :titleCount="stoppedDeploymentsCount">
            <deployments-index-table :items="stoppedDeployments"/>
        </oc-tab>
    </gl-tabs>
    </div>
</template>
