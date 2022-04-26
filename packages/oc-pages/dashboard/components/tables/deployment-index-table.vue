<script>
import TableComponent from '../../../vue_shared/components/oc/table.vue'
import {OcTab} from '../../../vue_shared/oc-components'
import EnvironmentCell from '../cells/environment-cell.vue'
import ResourceCell from '../cells/resource-cell.vue'
import DeploymentControls from '../cells/deployment-controls.vue'
import DeploymentStatusIcon from '../cells/shared/deployment-status-icon.vue'
import {GlTabs, GlModal} from '@gitlab/ui'
import {mapGetters, mapActions} from 'vuex'
import {redirectToJobConsole} from '../../../vue_shared/client_utils/pipelines'
import _ from 'lodash'
import * as routes from '../../router/constants'
import Vue from 'vue'



function deploymentGroupBy(item) {
    let result 
    try{
        result = `${item.deployment.name}:${item.application.name}`
    } catch(e) {return }
    return result
}

const tabFilters =  [
    {
        title: 'All'
    },
    {
        title: 'Running',
        filter(item) { return item.isDeployed }
    },
    {
        title: 'Drafts',
        filter(item) { return item.isDraft }
    },
    {
        title: 'Incomplete',
        filter(item) { return !item.isDeployed && !item.isDraft && !item.isUndeployed}
    },
    {
        title: 'Undeployed',
        filter(item) { return item.isUndeployed }
    }
]

export default {
    components: {
        TableComponent,
        EnvironmentCell,
        ResourceCell,
        DeploymentControls,
        GlModal,
        GlTabs,
        OcTab,
        DeploymentStatusIcon
    },
    props: {
        items: {
            type: Array,
            required: true
        },
        hideFilter: {
            type: Boolean,
            default: false
        },
        noMargin: {
            type: Boolean,
            default: false
        },
        noRouter: {
            type: Boolean,
            default: false
        },
        tabs: {
            type: Boolean,
            default: false
        }
    },
    data() {
        const self = this
        const fields = [
            /*
            {
                key: 'status',
                tableBodyStyles: {'justify-content': 'center'},
                groupBy: deploymentGroupBy,
                textValue: (item) => '@' + (item.deployment?.statuses || []).map(resource => resource?.name || '').join(' '),
                label: 'Status'
            },
            */
            {key: 'deployment', textValue: deploymentGroupBy, label: 'Deployment'},
            {
                key: 'environment',
                label: 'Environments',
                s: 'Environment',
                groupBy: (item) => item.environment?.name
            },
          /*
           * TODO figure out how to implement commit lookup
            {
                key: 'commit',
                shallow: true,
                label: 'Commit',
                textValue: () => 'which commit?',
            },
            {
                key: 'last-update',
                shallow: true,
                label: 'Last Update',
                textValue: () => '12/13/21',
            },
          */
            {
                key: 'resource',
                label: 'Resources',
                textValue: (item) => item.resource?.title,
                groupBy: (item) => item.resource?.name,
                pluralize: (...args) => self.pluralizeResources(...args),
                s: 'Resource'
            },
            {
                key: 'last-deploy',
                label: 'Last Deploy',
                textValue: () => '',
            },
            {
                key: 'controls',
                label: 'Open',
                tableBodyStyles: {'justify-content': 'flex-end'},
                groupBy: (item) => item.context.deployment?.name,
                textValue: () => '',
            },
        ]

        const query = this.$route.query
        const show = query?.show
        let currentTab = tabFilters.findIndex(tab => tab.title.toLowerCase() == show?.toLowerCase())
        if(currentTab == -1) currentTab = 0

        const intent = '', target = null
        return {fields, routes, intent, target, transition: false, currentTab}

    },
    methods: {
        ...mapActions([
            'deleteDeployment',
            'deployInto',
            'undeployFrom'
        ]),
        async deploy() {
            //return await redirectToJobConsole(await this.deployInto(this.deploymentParameters), {newTab: true})
            return await redirectToJobConsole(await this.deployInto(this.deploymentParameters))
        },
        async undeploy() {
            //return await redirectToJobConsole(await this.undeployFrom(this.deploymentParameters), {newTab: true})
            return await redirectToJobConsole(await this.undeployFrom(this.deploymentParameters))
        },
        statuses(scope) { return _.uniqBy(scope.item.context.deployment?.statuses || [], resource => resource?.status) },
        resumeEditingLink(scope) {
            const 
                application = scope.item.context.application,
                deployment = scope.item.context.deployment,
                environment = scope.item.context.environment,
                routerName = this.$router.name
            let to
            if(routerName == 'overview') {
                to =  {
                    name: 'deploymentDraftPage',
                    query: {
                        fn: deployment.title,
                    },
                    params: {
                        environment: environment.name,
                        slug: deployment.name
                    }
                }
                return {to}
            } else {
                to = `/${deployment.projectPath}/deployment-drafts/${environment.name}/${deployment.name}?fn=${deployment.title}`
                return to
            }
        },
        deploymentAttrs(scope) {
            const context = scope.item.context
            let href
            if(context.deployment?.__typename == 'DeploymentTemplate') href = this.resumeEditingLink(scope)
            else href = this.noRouter?
                `/dashboard/deployments/${context.environment.name}/${context.deployment.name}`: // TODO use from routes.js
                {name: routes.OC_DASHBOARD_DEPLOYMENTS, params: {name: context.deployment.name, environment: context.environment.name}}
            const result = typeof href == 'string'? {href}: {to: href}
            return result
        },
        async onModalConfirmed() {
            const {deployment, environment} = this.target
            switch(this.intent) {
                case 'undeploy':
                    this.undeploy()
                    return
                case 'deploy':
                    this.deploy()
                    return
                case 'delete':
                    await this.deleteDeployment({deploymentName: deployment.name, environmentName: environment.name})
                    this.$router.replace({hash: '#_'})
                    window.location.reload()
                default:
                    return

            }
        },
        onIntentToDelete(deployment, environment) {
            this.intent = 'delete'
            this.target = {deployment, environment}
        },
        onIntentToStop(deployment, environment) {
            this.intent = 'undeploy'
            this.target = {deployment, environment}
        },
        onIntentToStart(deployment, environment) {
            this.intent = 'deploy'
            this.target = {deployment, environment}
        },
        hasDeployPath(scope) {
            return !this.lookupDeployPath(scope.item.context.deployment?.name, scope.item.context.environment?.name)?.pipeline?.id
        },
        rowClass(item, type) {
            if (type !== 'row') return
            if(`#${item?.context?.deployment?.name}` == this.$route.hash) return 'highlight'
        },
        // TODO merge these
        deploymentItem(scope, method, ...args) {
            const environment = scope.item.context.environment
            const deployment = scope.item.context.deployment
            return this.deploymentItemDirect({deployment, environment}, method, ...args)
        },
        deploymentNameId(n) {
            return `deployment-${n}`
        },
        pluralizeResources(count, item) {
          if(count != 0) return
          const deploymentItem = this.deploymentItem({item})
          if(deploymentItem?.isDraft) return 'Not yet deployed' 
          //if(deploymentItem?.jobStatusIsUnsuccessful) return  ''
          return 'No resources'

        }
    },
    computed: {
        ...mapGetters([
            'pipelinesPath',
            'UNFURL_MOCK_DEPLOY',
            'lookupDeployPath',
            'getDeploymentDictionary',
            'getHomeProjectPath',
            'deploymentItemDirect'
        ]),
        projectPath() {
            const {deployment, environment} = this.target
            if(deployment.__typename == 'DeploymentTemplate') {
                return deployment.projectPath
            } else {
                const templateName = deployment.deploymentTemplate
                const template = this.getDeploymentDictionary(deployment.name, environment.name).DeploymentTemplate[templateName]
                return template?.projectPath
            }
        },
        deploymentParameters() {
            const {deployment, environment} = this.target
            const projectUrl = `${window.gon.gitlab_url}/${this.projectPath}.git`
            const deploymentBlueprint = deployment.__typename == 'DeploymentTemplate'?
                deployment.name : deployment.deploymentTemplate
            const mockDeploy = this.UNFURL_MOCK_DEPLOY
            return {
                projectUrl,
                deploymentBlueprint,
                deployPath: this.targetDeploymentDir,
                environmentName: environment.name,
                deploymentName: deployment.name,
                mockDeploy
            }
        },
        targetDeploymentDir() {
            if(!this.target) return ''
            const {environment, deployment} = this.target
            return `environments/${environment.name}/${this.projectPath}/${deployment.name}`
        },
        modal: {
            set(val) {
                if(!val) this.intent = ''
            },
            get() {
                return !!this.intent
            }
        },
        modalTitle() {
            const targetTitle = this.target?.deployment?.title || this.target?.deployment?.name
            switch(this.intent){
                case 'delete':
                    return `Are you sure you want to delete ${targetTitle}?`
                case 'undeploy':
                    return `Are you sure you want to undeploy ${targetTitle}? It will not be deleted and you will be able to redeploy at any time.`
                case 'deploy':
                    return `Deploy ${targetTitle}?`
                default: return ''
            }
        },
        useTabs() {
            return this.tabs && !this.noRouter
        },
        itemsSorted() {
            const self = this
            const result = [...this.items]
            result.sort((a,b) => {
                const diA = self.deploymentItem({item: a})
                const diB = self.deploymentItem({item: b})

                const createdAtA = diA.createdAt || 0
                const createdAtB = diB.createdAt || 0

                return createdAtB - createdAtA
                
            })
            return result
        },
        itemsByTab() {
            if(!this.useTabs) return
            const result = []
            for(const tab of tabFilters) {
                const tabItems = []
                for(const item of this.itemsSorted) {
                    const deploymentItem = this.deploymentItem({item})
                    if(!deploymentItem) {
                        console.error('deployment item not found for', item)
                        continue
                    }
                    if(!tab.filter || tab.filter(deploymentItem)) {
                        tabItems.push(item)
                    }
                }
                result.push(tabItems)
            }
            return result
        },
        countsByTab() {
            if(!this.useTabs) return
            let result = this.itemsByTab.map(list => {
                const counts = _.countBy(list, (item) => item.context.environment?.name + ':' + item.context.deployment?.name)
                return Object.keys(counts).length
            })
            return result
        },
        tableItems() {
            if(this.useTabs) {
                return this.itemsByTab[this.currentTab]
            }
            return this.itemsSorted
        },
        deleteWarning() {
            return this.intent == 'delete' && this.deploymentItemDirect({deployment: this.target.deployment, environment: this.target.environment}, 'isDeployed')
        }
    },
    watch: {
        currentTab(value) {
            const path = this.$route.path
            const show = value == 0? undefined : tabFilters[value]?.title?.toLowerCase()
            const query = {show}
            this.$router.replace({path, query})
        }
    },
    async mounted() {
        const vm = this
        this.$refs.container.style.transition = 'none'
        this.transition = false
        this.$refs.container.style.transition = ''

        if(this.$route.hash) {
            setTimeout(
                () => {
                    vm.transition = true
                    let el = document.querySelector(`#${vm.deploymentNameId(vm.$route.hash.slice(1))}`)
                    if(el) {
                        el.scrollIntoView()
                    }
                },
                500
            )
        }
    },
    tabFilters
}
</script>
<template>
    <div ref="container" class="deployment-index-table" :class="{transition}">
        <gl-modal
            modalId="deployment-index-table"
            :title="modalTitle"
            v-model="modal"
            size="sm"
            :actionPrimary="{text: deleteWarning? 'Delete Anyway': 'Confirm'}"
            :actionCancel="{text: 'Cancel'}"
            @primary="onModalConfirmed"
            >
            <div 
                v-if="deleteWarning" 
                class="m-3"
                >
                <div style="color: red">
                    If you delete a deployment before <b>teardown</b>, you will not be able to stop the deployment via unfurl.cloud.
                </div>
                <div class="mt-2">
                    Please consider running teardown first if you have not already or reporting an issue as alternatives to deletion.
                </div>
            </div>
        </gl-modal>
        <gl-tabs v-model="currentTab" v-if="useTabs">
            <oc-tab :titleCount="countsByTab[index]" :title="tab.title" :key="tab.title" v-for="(tab, index) in $options.tabFilters"/>
        </gl-tabs>
        <table-component :noMargin="noMargin" :hideFilter="hideFilter" :useCollapseAll="false" :items="tableItems" :fields="fields" :row-class="rowClass">
            <template #deployment$head>
                <div class="ml-2">
                    {{__('Deployment')}}
                </div>
            </template>
            <template #deployment="scope">
                <div class="d-flex">
                    <deployment-status-icon :scope="scope" />
                    <div v-if="scope.item.context.application" style="display: flex; flex-direction: column;" :class="{'hash-fragment': `#${scope.item.context.deployment.name}` == $route.hash}">
                        <a :href="`/${scope.item.context.deployment.projectPath}`">
                            <b> {{scope.item.context.application.title}}: </b>
                        </a>
                        <a :href="deploymentItem(scope, 'viewableLink')">
                            {{scope.item.context.deployment.title}}
                        </a>
                    </div>
                </div>
            </template>
            <!--template #resource$empty="scope">
                <div v-if="hasDeployPath(scope)">{{__('Not yet deployed')}}</div>
            </template-->
            <template #resource="scope">
                <resource-cell v-if="scope.item.context.deployment" :noRouter="noRouter" :resource="scope.item.context.resource" :deployment="scope.item.context.deployment" :environment="scope.item.context.environment"/>
            </template>
            <template #environment="scope">
                <environment-cell :noRouter="noRouter" :environment="scope.item.context.environment"/>
            </template>
            <template #last-deploy$all="scope">
                <div v-if="scope.item._depth == 0" style="letter-spacing: -0.06em">
                    {{deploymentItem(scope, 'createdAtText')}}
                    <div v-if="deploymentItem(scope, 'createdAt')">
                        <span v-if="deploymentItem(scope, 'consoleLink')">
                            <a :href="deploymentItem(scope, 'consoleLink')">View Job {{deploymentItem(scope, 'jobStatusMessage')}}</a> /
                            <a :href="deploymentItem(scope, 'artifactsLink')">View Artifacts</a>
                        </span>
                    </div>
                </div>

            </template>

            <template #controls$head> <div></div> </template>
            <template #controls$all="scope">
                <deployment-controls @startDeployment="onIntentToStart" @stopDeployment="onIntentToStop" @deleteDeployment="onIntentToDelete" v-if="scope.item._depth == 0" :scope="scope" />
            </template>

        </table-component>
    </div>

</template>
<style>
[id^="deployment-index-table"].modal-body { min-height: 0; padding: 0; }
</style>
<style scoped>

.deployment-index-table >>> .highlight {
    background-color: white;
    transition: background-color 0.5s;
}
.deployment-index-table.transition >>> .highlight {
    background-color: #FDFFE3;

}

.external-link-container >>> button {
    font-size: 1em;
    padding: 6px 9px;
    bottom: -2px
}
</style>
