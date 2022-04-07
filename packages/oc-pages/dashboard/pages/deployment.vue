<script>
import {mapGetters, mapActions} from 'vuex'
import DeploymentResources from '../../vue_shared/components/oc/deployment-resources.vue'
import DashboardBreadcrumbs from '../components/dashboard-breadcrumbs.vue'
import {bus} from 'oc_vue_shared/bus'
import * as routes from '../router/constants'
import {cloneDeep} from 'lodash'
export default {
    components: {DeploymentResources, DashboardBreadcrumbs},
    data() {
        return {bus, deployment: {}}
    },
    computed: {
        ...mapGetters(['getDeploymentDictionary', 'lookupDeployment']),
        breadcrumbItems() {
            return  [
                {to: {name: routes.OC_DASHBOARD_DEPLOYMENTS_INDEX}, text: 'Deployments'},
                {text: this.deployment?.title, href: '#'}
            ]
        }
    },
    methods: {
        ...mapActions(['useProjectState', 'populateDeploymentResources'])
    },
    beforeMount() {
        const environmentName = this.$route.params.environment
        const deploymentName = this.$route.params.name
        const state = this.getDeploymentDictionary(deploymentName, environmentName)
        if(!state) {
            const e = new Error(`Could not lookup deployment '${deploymentName}'.  It may contain errors or creation may have failed.  Please contact support if you believe this is a bug or you would like to suggest a more helpful error message.`)
            e.flash = true
            throw e
        }
        this.useProjectState({root: cloneDeep(state)})
        const deployment = this.lookupDeployment(deploymentName, environmentName)
        this.deployment = deployment
        this.populateDeploymentResources({deployment})
    }
}
</script>
<template>
    <div>
        <dashboard-breadcrumbs :items="breadcrumbItems" />
        <deployment-resources :display-validation="false" :display-status="true" :readonly="true" :bus="bus" />
    </div>
</template>
