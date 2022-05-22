<script>
import {mapGetters, mapActions} from 'vuex'
import DeploymentResources from '../../vue_shared/components/oc/deployment-resources.vue'
import DashboardBreadcrumbs from '../components/dashboard-breadcrumbs.vue'
import {bus} from 'oc_vue_shared/bus'
import * as routes from '../router/constants'
import {cloneDeep} from 'lodash'
import ConsoleWrapper from 'oc_vue_shared/components/console-wrapper.vue'
import {getJobsData} from 'oc_vue_shared/client_utils/pipelines'
export default {
    components: {DeploymentResources, DashboardBreadcrumbs, ConsoleWrapper},
    data() {
        return {bus, jobsData: null, viewReady: false}
    },
    computed: {
        ...mapGetters(['getDeploymentDictionary', 'lookupDeploymentOrDraft', 'lookupEnvironment', 'lookupDeployPath']),
        breadcrumbItems() {
            return  [
                {to: {name: routes.OC_DASHBOARD_DEPLOYMENTS_INDEX}, text: 'Deployments'},
                {text: this.deployment?.title, href: '#'}
            ]
        },
        deployment() {
            const environmentName = this.$route.params.environment
            const deploymentName = this.$route.params.name
            return this.lookupDeploymentOrDraft(deploymentName, environmentName)
        },
        environment() {
            const environmentName = this.$route.params.environment
            return this.lookupEnvironment(environmentName)
        },
        projectId() {
            return this.lookupDeployPath(this.deployment.name, this.environment.name)?.projectId
        },
        pipelineId() {
            return this.lookupDeployPath(this.deployment.name, this.environment.name)?.pipeline?.id
        },
        state() {
            return this.getDeploymentDictionary(this.deployment.name, this.environment.name)
        }
    },
    watch: {
        state(val) {
            this.prepareView()
        }
    },
    methods: {
        ...mapActions(['useProjectState', 'populateDeploymentResources']),
        prepareView() {
            this.viewReady = false

            if(!this.state) {
                const e = new Error(`Could not lookup deployment '${deploymentName}'.  It may contain errors or creation may have failed.`)
                e.flash = true
                throw e
            }
            this.useProjectState({root: cloneDeep(this.state)})
            this.populateDeploymentResources({deployment: this.deployment, environmentName: this.environment.name})
            this.viewReady = true
        }
    },
    async mounted() {
        if(!window.gon.unfurl_gui) {
            this.jobsData = await getJobsData({projectId: this.projectId, id: this.pipelineId})
        }
        this.prepareView()
    }
}
</script>
<template>
    <div id="deployment-view-container">
        <dashboard-breadcrumbs style="overflow-anchor: auto" :items="breadcrumbItems" />
        <console-wrapper v-if="jobsData" :jobs-data="jobsData" />
        <deployment-resources v-if="viewReady" :custom-title="deployment.title" :display-validation="false" :display-status="true" :readonly="true" :bus="bus" />
    </div>
</template>
<style>
* {
    overflow-anchor: none;
}
</style>
