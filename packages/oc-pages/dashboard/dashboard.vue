<script>
import createFlash, { FLASH_TYPES } from '~/flash';
import {mapActions, mapGetters} from 'vuex'
import {lookupCloudProviderAlias} from '../vue_shared/util.mjs'
import {deleteEnvironmentByName} from '../vue_shared/client_utils/environments'
import * as routes from './router/constants'
export default {
    name: 'Dashboard',
    data() {return {isLoaded: false, doNotRender: false}},
    methods: {
        ...mapActions([
            'loadDashboard',
            'handleResize',
            'updateEnvironment',
            'populateJobsList',
            'populateDeploymentItems',
        ])
    },
    computed: {
        ...mapGetters([
            'isDashboardLoaded',
            'getDashboardItems',
            'getHomeProjectPath'
        ])
    },
    async mounted() {
        await Promise.all([this.loadDashboard(), this.populateJobsList()])
        this.populateDeploymentItems(this.getDashboardItems)
        this.handleResize()
        
        const flash = sessionStorage['oc_flash']
        if(flash) {
            createFlash(JSON.parse(flash))
            delete sessionStorage['oc_flash']
        }

        this.selectedEnvironment = this.$route.query?.env || sessionStorage['instantiate_env']
        this.newEnvironmentProvider = this.$route.query?.provider || sessionStorage['instantiate_provider']
        const expectsCloudProvider = sessionStorage['expect_cloud_provider_for']

        delete sessionStorage['instantiate_env']
        delete sessionStorage['instantiate_provider']

        if(expectsCloudProvider && !(this.selectedEnvironment && this.newEnvironmentProvider)) {
            let route
            try {
                this.doNotRender = true
                route = this.$router.resolve({name: routes.OC_DASHBOARD_ENVIRONMENTS_INDEX, query: {}})

                sessionStorage['oc_flash'] = JSON.stringify({
                    message: `Creation of environment "${expectsCloudProvider}" cancelled.`,
                    type: FLASH_TYPES.WARNING
                })

                await deleteEnvironmentByName(this.getHomeProjectPath, expectsCloudProvider)
            } catch(e) {
                delete sessionStorage['oc_flash']
                console.error(e)
            }
            window.location.href = route.href
        }

        delete sessionStorage['expect_cloud_provider_for']


        // add environment to environments.json
        if(this.selectedEnvironment && this.newEnvironmentProvider) {
            const primary_provider = {name: 'primary_provider', type: lookupCloudProviderAlias(this.newEnvironmentProvider), __typename: 'ResourceTemplate'}

            const query = this.$route.query
            delete query.provider
            delete query.env

            await this.updateEnvironment({
                envName: this.selectedEnvironment,
                patch: {primary_provider, connections: {primary_provider}}
            })
        }

        this.isLoaded = true


    }
}
</script>
<template>
    <div>
        <router-view v-if="isLoaded && !doNotRender"/>
    </div>
</template>
