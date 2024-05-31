<script>
import {GlButton, GlIcon} from '@gitlab/ui'
import EnvironmentsIndexTable from '../components/tables/environment-index-table.vue'
import CreateEnvironmentModal from '../components/create-environment-modal.vue'
import DashboardBreadcrumbs from '../components/dashboard-breadcrumbs.vue'
import {mapGetters} from 'vuex'
import * as routes from '../router/constants'
import {__} from '~/locale'

const standalone = window.gon.unfurl_gui

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
            standalone,
        }
    },
    computed: {
        ...mapGetters([
            'getDashboardItems',
            'userCanEdit',
            'hasCriticalErrors'
        ]),
        displayModal: {
            get() {
                return this.$route.query.hasOwnProperty('create')
            },
            set(value) {
                const query = {...this.$route.query}
                if(value && !this.hasCriticalErrors) {
                    query.create = null
                } else {
                    delete query.create
                }

                const path = this.$route.path
                this.$router.replace({path, query})
            }
        },
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
        <div class="row d-flex flex-wrap mx-3 my-5 justify-content-between">
            <div class="mr-4">
                <div v-show="getDashboardItems.length == 0">
                    This page will show all of your environments once you've created some. <br>
                    Click <a href="https://unfurl.cloud/help/glossary" target="_blank">here</a> to learn more about how environments work on unfurl.cloud.
                </div>
            </div>
            <gl-button v-if="userCanEdit && !standalone" variant="confirm" @click="_ => displayModal = true"><gl-icon name="plus" /> Create New Environment</gl-button>
        </div>
        <environments-index-table v-if="getDashboardItems.length > 0" :items="getDashboardItems"/>
            
        <create-environment-modal v-model="displayModal" allow-any />
    </div>
</template>
