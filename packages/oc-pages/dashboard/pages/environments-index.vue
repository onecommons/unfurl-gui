<script>
import {GlButton, GlIcon} from '@gitlab/ui'
import EnvironmentsIndexTable from '../components/tables/environment-index-table.vue'
import CreateEnvironmentModal from '../components/create-environment-modal.vue'
import DashboardBreadcrumbs from '../components/dashboard-breadcrumbs.vue'
import {mapGetters} from 'vuex'
import * as routes from '../router/constants'
import {__} from '~/locale'


export default {
    components: {GlButton, GlIcon, DashboardBreadcrumbs, EnvironmentsIndexTable, CreateEnvironmentModal},
    data() {
        const query = this.$route.query
        const show = query?.show
        const currentTab = (
            show == 'running' ? 1:
            show == 'stopped' ? 2:
            0
        )
        
        const breadcrumbItems = [
            {text: __('Environments'), href: '#'}
        ]

        return {
            currentTab,
            routes,
            breadcrumbItems,
            displayModal: false,
        }
    },
    computed: {
        ...mapGetters([
            'getDashboardItems',
            'runningDeploymentsCount',
            'stoppedDeploymentsCount'
        ]),
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
        <div class="row d-flex m-5 justify-content-end">
            <gl-button variant="confirm" @click="_ => displayModal = true"><gl-icon name="plus" /> Create New Environment</gl-button>
        </div>
        <environments-index-table :items="getDashboardItems"/>
            
        <create-environment-modal v-model="displayModal" />
    </div>
</template>
