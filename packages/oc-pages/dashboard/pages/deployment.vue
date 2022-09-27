<script>
import {mapGetters, mapActions} from 'vuex'
import DeploymentResources from 'oc_vue_shared/components/oc/deployment-resources.vue'
import DashboardBreadcrumbs from '../components/dashboard-breadcrumbs.vue'
import ShareResourceToggle from '../components/share-resource-toggle.vue'
import {bus} from 'oc_vue_shared/bus'
import * as routes from '../router/constants'
import {cloneDeep} from 'lodash'
import ConsoleWrapper from 'oc_vue_shared/components/console-wrapper.vue'
import {GlTabs} from '@gitlab/ui'
import {OcTab} from 'oc_vue_shared/oc-components'
import {getJobsData} from 'oc_vue_shared/client_utils/pipelines'
import {fetchProjectPipelines} from 'oc_vue_shared/client_utils/projects'
import {FLASH_TYPES, default as createFlash} from 'oc_vue_shared/client_utils/oc-flash'
import {notFoundError} from 'oc_vue_shared/client_utils/error'
import {DeploymentIndexTable} from 'oc_dashboard/components'

export default {
    components: {DeploymentResources, DashboardBreadcrumbs, ConsoleWrapper, GlTabs, OcTab, DeploymentIndexTable, ShareResourceToggle},
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
            'lookupDeployPath',
            'getDashboardItems',
            'isAcknowledged',
            'environmentResourceTypeDict'
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
            return Object.freeze(this.getDeploymentDictionary(this.deploymentName, this.environmentName))
        },
        tableItems() {
            return this.getDashboardItems.filter(item => {
                return (
                    item.context.environment.name == this.environmentName &&
                    item.context.deployment.name == this.deploymentName
                )
            })
        }
    },
    watch: {
        state(val) {
            this.prepareView()
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
                if(!val.pipeline?.upstream_project_id) return
                const upstreamPipeline = (await fetchProjectPipelines(val.pipeline.upstream_project_id)).shift()
                const acknowledgement = `upstream-failure-${upstreamPipeline.id}`
                if(upstreamPipeline?.status == 'failed' && !this.isAcknowledged(acknowledgement)) {
                    const message = 'An error occurred in an upstream pipeline.'
                    createFlash({type: FLASH_TYPES.ALERT, message, linkTo: upstreamPipeline.web_url, linkText: 'View failed pipeline'})
                    this.acknowledge(acknowledgement)
                }
            }
        }
    },
    methods: {
        ...mapActions(['useProjectState', 'fetchProject', 'populateDeploymentResources', 'acknowledge']),
        async prepareView() {
            this.viewReady = false

            if(!this.state) {
                const e = new Error(`Could not lookup deployment '${deploymentName}'.  It may contain errors or creation may have failed.`)
                e.flash = true
                throw e
            }
            if(this.deployment.__typename == 'DeploymentTemplate') {
                await this.fetchProject({projectPath: this.deployment.projectPath})
                this.useProjectState({root: cloneDeep(this.state), shouldMerge: true})
            } else {
                let ResourceType =  this.state.ResourceType
                if(!ResourceType) {
                    ResourceType = this.environmentResourceTypeDict(this.environment.name)
                }
                this.useProjectState({root: cloneDeep({...this.state, ResourceType})})
            }
            this.populateDeploymentResources({deployment: this.deployment, environmentName: this.environment.name})
            this.viewReady = true
        },
        setTabToConsoleIfNeeded() {
            if(this.$route.query?.show == 'console') {
                this.currentTab = 1
            }
        }
    },
    created() {
        if(!this.viewReady) this.prepareView()
    },
    async mounted() {
        if(!(this.environment && this.deployment)) {
            notFoundError()
        }
        if(!window.gon.unfurl_gui && this.projectId && this.pipelineId) {
            this.jobsData = await getJobsData({projectId: this.projectId, id: this.pipelineId})
        }
        this.setTabToConsoleIfNeeded()
    }
}
</script>
<template>
    <div id="deployment-view-container">
        <dashboard-breadcrumbs style="overflow-anchor: auto" :items="breadcrumbItems" />
        <deployment-index-table :items="tableItems" hide-filter />
        <gl-tabs class="mt-4" v-model="currentTab">
            <oc-tab title="Deployment" />
            <oc-tab v-show="jobsData" title="Console" />
        </gl-tabs>
        <deployment-resources ref="deploymentResources" v-show="currentTab == 0" v-if="viewReady" :custom-title="deployment.title" :display-validation="false" :display-status="true" :readonly="true" :bus="bus">
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
