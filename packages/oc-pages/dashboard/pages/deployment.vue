<script>
import {mapGetters, mapActions} from 'vuex'
import Vue from 'vue'
import {OcTab, DeploymentResources} from 'oc_vue_shared/components/oc'
import ConsoleWrapper from 'oc_vue_shared/components/console-wrapper.vue'
import DashboardBreadcrumbs from '../components/dashboard-breadcrumbs.vue'
import ShareResourceToggle from '../components/share-resource-toggle.vue'
import JobSummary from '../components/job-summary.vue'
import {bus} from 'oc_vue_shared/bus'
import * as routes from '../router/constants'
import {debounce, cloneDeep} from 'lodash'
import {GlTabs, GlLoadingIcon} from '@gitlab/ui'
import {getJobsData} from 'oc_vue_shared/client_utils/pipelines'
import {fetchProjectPipelines} from 'oc_vue_shared/client_utils/projects'
import {FLASH_TYPES} from 'oc_vue_shared/client_utils/oc-flash'
import {notFoundError} from 'oc_vue_shared/client_utils/error'
import {sleep} from 'oc_vue_shared/client_utils/misc'
import {DeploymentIndexTable} from 'oc_dashboard/components'

const ONE_DAY = 24 * 60 * 60
const ONE_HOUR = 60 * 60
const ONE_MINUTE = 60

export default {
    name: 'Deployment',
    components: {
        DeploymentResources,
        DashboardBreadcrumbs,
        ConsoleWrapper,
        GlTabs,
        OcTab,
        DeploymentIndexTable,
        ShareResourceToggle,
        GlLoadingIcon,
        JobSummary,
    },
    data() {
        const environmentName = this.$route.params.environment
        const deploymentName = this.$route.params.name
        return {bus, jobsData: null, viewReady: false, currentTab: 0, currentTabDebounced: 0, environmentName, deploymentName, now: Date.now(), counter: 0}
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
            'hasCriticalErrors',
            'getJobSummary'
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
        deploymentItem() {
            return this.deploymentItemDirect({environment: this.environmentName, deployment: this.deploymentName})
        },
        pipelineId() {
            return this.deploymentItem.pipeline?.id
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
        },

        autostopRemainingTime() {
            if(!this.deploymentItem?.autostopScheduled) return 0
            return (this.deploymentItem.autostopScheduled - this.now) / 1000 - this.counter
        },

        autostopRemainingDays() {
            if(this.autostopRemainingTime >= ONE_DAY) {
                return Math.floor(this.autostopRemainingTime / ONE_DAY)
            }
            return null
        },

        autostopRemainingHours() {
            if(this.autostopRemainingTime >= ONE_HOUR) {
                return Math.floor(this.autostopRemainingTime % ONE_DAY / ONE_HOUR).toString().padStart(2, '0')
            }
            return null
        },

        autostopRemainingMinutes() {
            if(this.autostopRemainingTime >= ONE_MINUTE) {
                return Math.floor(this.autostopRemainingTime % ONE_HOUR / ONE_MINUTE).toString().padStart(2, '0')
            }
            return null
        },

        autostopRemainingSeconds() {
            return (Math.floor(this.autostopRemainingTime) % ONE_MINUTE).toString().padStart(2, '0')
        },

        autostopRemainingTimeDisplay() {
            const timeComponents = [
                this.autostopRemainingDays,
                this.autostopRemainingHours,
                this.autostopRemainingMinutes,
                this.autostopRemainingSeconds
            ].filter(t => !isNaN(parseInt(t)))

            if(timeComponents.length > 1) {
                return timeComponents.join(':')
            } else if (this.autostopRemainingSeconds > 1) {
                return `${this.autostopRemainingSeconds} seconds`
            } else if (this.autostopRemainingSeconds == 1) {
                return '01 second'
            } else {
                return ''
            }
        },

        overrideStatus() {
            return this.showStartingUpStatus || this.deploymentItem.autostopScheduled
        }
    },
    watch: {
        state(val) {
            if(this.deployment?.name && this?.environment.name) this.prepareView()
        },
        $route() {
            const lineNo = this.$route.hash.match(/L\d+/)
            if(this.$route.hash && !lineNo) {
                if(this.currentTab > 0) {
                    this.currentTab = 0
                }
                this.$refs.deploymentResources.scrollDown(this.$route.hash, 500)
            } else if(lineNo && this.currentTab == 2) {
                this.setTabToConsoleIfNeeded()
            }
        },

        currentTabDebounced(tab, prev) {
            let hash = this.$route.hash
            let query = this.$route.query
            const lineNo = hash.match(/L\d+/)

            if(hash && !lineNo && tab == 1){
                hash = undefined
            } else if((query?.show || lineNo) && tab == 0) {
                query = undefined
                if (lineNo) {
                    hash = undefined
                }
            } else if (tab > 1 && hash) {
                hash = undefined
            } else {
                return
            }

            this.$router.push({...this.$route, hash, query})
        },

        currentTab: debounce(function (val) {
            if(val != this.currentTabDebounced) {
                this.currentTabDebounced = val
            }
        }, 100),

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
        async jobsData(val) {
            // imagine my surprise when the tabs are reordering themselves
            await sleep(100)
            await Vue.nextTick()

            this.setTabToConsoleIfNeeded()
        },
        async autostopRemainingTime(val) {
            if(Math.floor(val) == 1) {
                await sleep(3000)
                /*
                await this.populateJobsList()
                await this.populateDeploymentItems(this.getDashboardItems)
                */

                location.search = '?show=console'
            }
        }
    },
    methods: {
        ...mapActions(['useProjectState', 'populateDeploymentResources', 'acknowledge', 'createFlash', 'populateDeploymentItems', 'populateJobsList',]),
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

            let ResourceType =  this.state.ResourceType
            if(!ResourceType) {
                ResourceType = this.environmentResourceTypeDict(this.environment.name)
            }
            const projectPath = this.deployment?.projectPath || this.state.DeploymentTemplate[this.deployment.deploymentTemplate]?.projectPath
            await this.useProjectState({projectPath, root: cloneDeep({...this.state, DeploymentEnvironment, ResourceType})})

            this.populateDeploymentResources({deployment: this.deployment, environmentName: this.environment.name})
            this.viewReady = true
        },
        async setTabToConsoleIfNeeded() {
            const lineNo = this.$route.hash.match(/L\d+/)
            if((this.$route.query?.show == 'console'  || lineNo) && this.jobsData) {
                if(document.querySelector('#ensure-console-tab-mounted')) {
                    this.currentTab = 1


                    const el = document.querySelector(lineNo?.input)
                    if(el) {
                        window.scrollTo(0, document.body.scrollHeight)
                        window.requestAnimationFrame(() => {
                            el.scrollIntoView()
                        })
                    } else if(lineNo?.input) {
                        await sleep(100)
                        this.setTabToConsoleIfNeeded()
                    }
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

        setInterval(() => ++this.counter, 1000)

    },
}
</script>
<template>
    <div id="deployment-view-container">
        <dashboard-breadcrumbs style="overflow-anchor: auto" :items="breadcrumbItems" />
        <deployment-index-table :items="tableItems" hide-filter />
        <gl-tabs ref="tabs" class="mt-4" v-model="currentTab">
            <oc-tab title="Deployment" key="0"/>
            <oc-tab ref="consoleTab" v-if="jobsData" title="Console" key="1">
                <div id="ensure-console-tab-mounted" />
            </oc-tab>
            <oc-tab v-if="getJobSummary && jobsData" title="Job Summary" key="2">
                <job-summary :jobs-data="jobsData" />
            </oc-tab>
        </gl-tabs>
        <deployment-resources ref="deploymentResources" v-show="currentTab == 0" v-if="viewReady" :custom-title="deployment.title" :display-validation="false" :display-status="true" :readonly="true" :bus="bus">
            <template #primary-controls="card">
                <share-resource-toggle class="mr-1" :card="card" />
            </template>

            <template v-if="overrideStatus" #status>
                <div v-if="autostopRemainingTimeDisplay && deploymentItem.autostopScheduled && deploymentItem.isRunning" class="d-inline-flex align-items-center ml-3">
                    Deployment will be automatically stopped in {{autostopRemainingTimeDisplay}}
                </div>

                <div v-else-if="showStartingUpStatus" class="d-inline-flex align-items-center ml-3">
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
