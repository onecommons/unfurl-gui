<script>
import {mapGetters, mapActions} from 'vuex'
import DeploymentResources from '../../vue_shared/components/oc/deployment-resources.vue'
import DashboardBreadcrumbs from '../components/dashboard-breadcrumbs.vue'
import {bus} from 'oc_vue_shared/bus'
import * as routes from '../router/constants'
import {cloneDeep} from 'lodash'
import ConsoleWrapper from 'oc_vue_shared/components/console-wrapper.vue'
import {GlTabs} from '@gitlab/ui'
import {OcTab} from 'oc_vue_shared/oc-components'
import {getJobsData} from 'oc_vue_shared/client_utils/pipelines'
import {DeploymentIndexTable} from 'oc_dashboard/components'
export default {
    components: {DeploymentResources, DashboardBreadcrumbs, ConsoleWrapper, GlTabs, OcTab, DeploymentIndexTable},
    data() {
        return {bus, jobsData: null, viewReady: false, currentTab: 0}
    },
    computed: {
        ...mapGetters([
            'getDeploymentDictionary',
            'lookupDeploymentOrDraft',
            'lookupEnvironment',
            'lookupDeployPath',
            'getDashboardItems',
            'environmentResourceTypeDict'
        ]),
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
        },
        tableItems() {
            return this.getDashboardItems.filter(item => {
                return (
                    item.context.environment.name == this.environment.name &&
                    item.context.deployment.name == this.deployment.name
                )
            })
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
            let state = {...this.state}
            if(!state.ResourceType) {
              state.ResourceType = this.environmentResourceTypeDict(this.environment.name)
            }
            this.useProjectState({root: cloneDeep(state)})
            this.populateDeploymentResources({deployment: this.deployment, environmentName: this.environment.name})
            this.viewReady = true
        },
        setTabToConsoleIfNeeded() {
            if(!this.$route.query?.show == 'console') {
                this.currentTab = 1
            }
        }
    },
    async mounted() {
        if(!window.gon.unfurl_gui) {
            this.jobsData = await getJobsData({projectId: this.projectId, id: this.pipelineId})
        }
        this.prepareView()
        if(this.$route.query?.show == 'console') {
            this.currentTab = 1
        }
    }
}
</script>
<template>
    <div id="deployment-view-container">

        <dashboard-breadcrumbs style="overflow-anchor: auto" :items="breadcrumbItems" />
        <deployment-index-table :items="tableItems" hide-filter />
        <gl-tabs class="mt-4" v-model="currentTab">
            <oc-tab title="Deployment">
                <deployment-resources v-if="viewReady" :custom-title="deployment.title" :display-validation="false" :display-status="true" :readonly="true" :bus="bus" />
            </oc-tab>
            <oc-tab title="Console">
                <console-wrapper ref="consoleWrapper" @active-deployment="setTabToConsoleIfNeeded" v-if="jobsData" :jobs-data="jobsData" />
            </oc-tab>
        </gl-tabs>
    </div>
</template>
<style>
* {
    overflow-anchor: none;
}
</style>
