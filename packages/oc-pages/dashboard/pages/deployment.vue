<script>
import {mapGetters, mapActions} from 'vuex'
import DeploymentResources from 'oc_vue_shared/components/oc/deployment-resources.vue'
import DashboardBreadcrumbs from '../components/dashboard-breadcrumbs.vue'
import ShareResourceToggle from '../components/share-resource-toggle.vue'
import {bus} from 'oc_vue_shared/bus'
import * as routes from '../router/constants'
import {cloneDeep} from 'lodash'
import ConsoleWrapper from 'oc_vue_shared/components/console-wrapper.vue'
import {GlTabs, GlLoadingIcon} from '@gitlab/ui'
import {OcTab} from 'oc_vue_shared/oc-components'
import {getJobsData} from 'oc_vue_shared/client_utils/pipelines'
import {fetchProjectPipelines} from 'oc_vue_shared/client_utils/projects'
import {FLASH_TYPES} from 'oc_vue_shared/client_utils/oc-flash'
import {notFoundError} from 'oc_vue_shared/client_utils/error'
import {sleep} from 'oc_vue_shared/client_utils/misc'
import {DeploymentIndexTable} from 'oc_dashboard/components'

export default {
    components: {DeploymentResources, DashboardBreadcrumbs, ConsoleWrapper, GlTabs, OcTab, DeploymentIndexTable, ShareResourceToggle, GlLoadingIcon},
    data() {
        const environmentName = this.$route.params.environment
        const deploymentName = this.$route.params.name
        return {bus, jobsData: null, viewReady: false, currentTab: 0, environmentName, deploymentName}
    },
    computed: {
        ...mapGetters([
            'getDeploymentDictionary',
            'deploymentItemDirect',
            'lookupDeploymentOrDraft',
            'lookupEnvironment',
            'getEnvironmentDefaults',
            'lookupDeployPath',
            'getDashboardItems',
            'isAcknowledged',
            'environmentResourceTypeDict',
            'environmentsAreReady',
            'pollingStatus',
            'formattedDeploymentEta',
        ]),
        breadcrumbItems() {
            return  [
                {to: {name: routes.OC_DASHBOARD_DEPLOYMENTS_INDEX}, text: 'Deployments'},
                {text: this.deployment?.title, href: '#'}
            ]
        },
        deployment() {
            return this.lookupDeploymentOrDraft(this.deploymentName, this.environmentName)
        },
        environment() {
            return this.lookupEnvironment(this.environmentName)
        },
        projectId() {
            const deployPath = this.lookupDeployPath(this.deploymentName, this.environmentName)
            return deployPath?.project_id || deployPath?.projectId // project_id will be used on DeploymentPath records going forward
        },
        pipelineId() {
            return this.lookupDeployPath(this.deploymentName, this.environmentName)?.pipeline?.id
        },
        deploymentItem() {
            return this.deploymentItemDirect({environment: this.environmentName, deployment: this.deploymentName})
        },
        state() {
            if(! this.environmentsAreReady) return null
            return Object.freeze(this.getDeploymentDictionary(this.deploymentName, this.environmentName))
        },
        tableItems() {
            return this.getDashboardItems.filter(item => {
                return (
                    item.context.environment.name == this.environmentName &&
                    item.context.deployment.name == this.deploymentName
                )
            })
        },
        showStartingUpStatus() {
            return this.pollingStatus(this.deployment.name) == 'PENDING'
        }
    },
    watch: {
        state(val) {
            if(this.deployment?.name && this?.environment.name) this.prepareView()
        },
        $route() {
            if(this.$route.hash) {
                if(this.currentTab == 1) {
                    this.currentTab = 0
                }
                this.$refs.deploymentResources.scrollDown(this.$route.hash, 500)
            }
        },
        currentTab(tab) {
            if(this.$route.hash && tab == 1){
                this.$router.push({...this.$route, hash: undefined})
            }
            else if(this.$route.query?.show && tab == 0) {
                this.$router.push({...this.$route, query: undefined})
            }
        },
        deploymentItem: {
            immediate: true,
            async handler(val) {
                if(!val?.pipeline?.upstream_project_id) return
                const upstreamPipeline = (await fetchProjectPipelines(val.pipeline.upstream_project_id)).shift()
                const acknowledgement = `upstream-failure-${upstreamPipeline.id}`
                if(upstreamPipeline?.status == 'failed' && !this.isAcknowledged(acknowledgement)) {
                    const message = 'An error occurred in an upstream pipeline.'
                    this.createFlash({type: FLASH_TYPES.ALERT, message, linkTo: upstreamPipeline.web_url, linkText: 'View failed pipeline'})
                    this.acknowledge(acknowledgement)
                }
            }
        },
        jobsData(val) {
            this.setTabToConsoleIfNeeded()
        }
    },
    methods: {
        ...mapActions(['useProjectState', 'fetchProject', 'populateDeploymentResources', 'acknowledge', 'createFlash']),
        async prepareView() {
            this.viewReady = false

            if(!this.state) {
                const e = new Error(`Could not lookup deployment '${this.deployment.name}'.  It may contain errors or creation may have failed.`)
                e.flash = true
                throw e
            }

            const DeploymentEnvironment = {
                [this.environment.name]: this.lookupEnvironment(this.environment.name),
                defaults: this.getEnvironmentDefaults
            }

            if(this.deployment.__typename == 'DeploymentTemplate') {
                const projectPath = this.deployment.projectPath
                await this.fetchProject({projectPath})
                this.useProjectState({root: cloneDeep({...this.state, DeploymentEnvironment}), shouldMerge: true, projectPath})
            } else {
                console.assert(this.deployment.__typename == 'Deployment', 'Expected deployment to be either DeploymentTemplate or Deployment')
                let ResourceType =  this.state.ResourceType
                if(!ResourceType) {
                    ResourceType = this.environmentResourceTypeDict(this.environment.name)
                }
                const projectPath = this.state.DeploymentTemplate[this.deployment.deploymentTemplate].projectPath
                this.useProjectState({projectPath, root: cloneDeep({...this.state, DeploymentEnvironment, ResourceType})})
            }
            this.populateDeploymentResources({deployment: this.deployment, environmentName: this.environment.name})
            this.viewReady = true
        },
        async setTabToConsoleIfNeeded() {
            if(this.$route.query?.show == 'console' && this.jobsData) {
                if(document.querySelector('#ensure-console-tab-mounted')) {
                    this.currentTab = 1
                } else {
                    await sleep(100)
                    this.setTabToConsoleIfNeeded()
                }
            }
        }
    },
    async created() {
        if(!this.viewReady) this.prepareView()
        if(!(this.environment && this.deployment)) {
            notFoundError()
        }
        if(!window.gon.unfurl_gui && this.projectId && this.pipelineId) {
            this.jobsData = await getJobsData({projectId: this.projectId, id: this.pipelineId})
        }

    },
}
</script>
<template>
    <div id="deployment-view-container">
        <dashboard-breadcrumbs style="overflow-anchor: auto" :items="breadcrumbItems" />
        <deployment-index-table :items="tableItems" hide-filter />
        <gl-tabs class="mt-4" v-model="currentTab">
            <oc-tab title="Deployment" />
            <oc-tab ref="consoleTab" v-if="jobsData" title="Console">
                <div id="ensure-console-tab-mounted" />
            </oc-tab>
        </gl-tabs>
        <deployment-resources ref="deploymentResources" v-show="currentTab == 0" v-if="viewReady" :custom-title="deployment.title" :display-validation="false" :display-status="true" :readonly="true" :bus="bus">
            <template #primary-controls="card">
                <share-resource-toggle class="mr-1" :card="card" />
            </template>

            <template v-if="showStartingUpStatus" #status>
                <div class="d-inline-flex align-items-center">
                    <gl-loading-icon class="mr-1"/>
                    <span>Waiting for <b>{{deployment.title}}</b> to go live (eta: {{formattedDeploymentEta(deployment.name)}})</span>
                </div>
            </template>

            <template #controls="card">
                <share-resource-toggle :card="card" />
            </template>
        </deployment-resources>
        <console-wrapper v-show="currentTab == 1" ref="consoleWrapper" @active-deployment="setTabToConsoleIfNeeded" v-if="jobsData" :jobs-data="jobsData" />
    </div>
</template>
<style>
* {
    overflow-anchor: none;
}
</style>
