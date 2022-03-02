<script>
import {mapActions, mapGetters} from 'vuex'
import {lookupCloudProviderAlias} from '../vue_shared/util.mjs'
export default {
    name: 'Dashboard',
    data() {return {isLoaded: false}},
    methods: {
        ...mapActions([
            'loadDashboard',
            'handleResize',
            'updateEnvironment'
        ])
    },
    computed: {
        ...mapGetters([
            'isDashboardLoaded'
        ])
    },
    async mounted() {
        await this.loadDashboard()
        this.handleResize()

        this.selectedEnvironment = this.$route.query?.env
        this.newEnvironmentProvider = this.$route.query?.provider

        // add environment to environments.json
        if(this.selectedEnvironment && this.newEnvironmentProvider) {
            const primary_provider = {type: lookupCloudProviderAlias(this.newEnvironmentProvider), __typename: 'ResourceTemplate'}

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
    <!-- forgive me -->
    <div style="font-size: 0.95em;">
        <router-view v-if="isLoaded"/>
    </div>
</template>
