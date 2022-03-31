<script>
import TableComponent from '../../../vue_shared/components/oc/table.vue'
import StatusIcon from '../../../vue_shared/components/oc/Status.vue';
import EnvironmentCell from '../cells/environment-cell.vue'
import ResourceCell from '../cells/resource-cell.vue'
import DeploymentControls from '../cells/deployment-controls.vue'
import {GlButton, GlIcon, GlModal} from '@gitlab/ui'
import {mapGetters, mapActions} from 'vuex'
import {redirectToJobConsole} from '../../../vue_shared/client_utils/pipelines'
import _ from 'lodash'
import * as routes from '../../router/constants'
import DeploymentItem from './deployment-index-table/deployment-item'
import gql from 'graphql-tag'
import graphqlClient from '../../graphql'
import Vue from 'vue'



function deploymentGroupBy(item) {

    let result 
    try{
        result = `${item.deployment.name}:${item.application.name}`
    } catch(e) {return }
    return result
}

const LOOKUP_JOBS = gql`
    query lookupJobs($fullPath: ID!){
        project(fullPath: $fullPath){
            name
            pipelines {
                count
                nodes {
                    id
                    jobs {
                        count
                        nodes {
                            id
                            status

                        }
                    }
                }
            }
        }
    }
`

export default {
    components: {
        TableComponent, StatusIcon, EnvironmentCell, ResourceCell, GlButton, GlIcon, DeploymentControls, GlModal
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
        }
    },
    data() {
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

        const intent = '', target = null
        return {fields, routes, intent, target, transition: false, jobsByPipelineId: {}}

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
                environment = scope.item.context.environment
            const to =  {
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
        },
        deploymentAttrs(scope) {
            const context = scope.item.context
            if(context.deployment?.__typename == 'DeploymentTemplate') return this.resumeEditingLink(scope)
            const href = this.noRouter?
                `/dashboard/deployments/${context.environment.name}/${context.deployment.name}`: // TODO use from routes.js
                {name: routes.OC_DASHBOARD_DEPLOYMENTS, params: {name: context.deployment.name, environment: context.environment.name}}
            return this.noRouter? {href}: {to: href}
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
        deploymentItem(scope, method, ...args) {
            let result = this.deploymentItems[`${scope.item.context.environment?.name}:${scope.item.context.deployment?.name}`]
            if(result && method) {
                if(args.length) {
                    result = result[method](...args)
                } else {
                    result = result[method]
                }
            }
            return result
        },
        deploymentNameId(n) {
            return `deployment-${n}`
        }
    },
    computed: {
        ...mapGetters(['pipelinesPath', 'UNFURL_MOCK_DEPLOY', 'lookupDeployPath', 'getDeploymentDictionary', 'getHomeProjectPath']),
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
        deploymentItems() {
            const dict = {}
            for(const item of this.items) {
                let itemKey
                try {
                    itemKey = `${item.context.environment.name}:${item.context.deployment.name}`
                } catch(e) {continue}
                if(!dict[itemKey]) {
                    const context = {}
                    context.environment = item.context.environment
                    context.deployment = item.context.deployment
                    context.application = item.context.application
                    context.deployPath = this.lookupDeployPath(context.deployment.name, context.environment.name)
                    context.job = this.jobsByPipelineId[context.deployPath?.pipeline?.id]
                    context.projectPath = this.getHomeProjectPath
                    dict[itemKey] = new DeploymentItem(context)
                }
            }
            return dict
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

        const result = await graphqlClient.defaultClient.query({
            query: LOOKUP_JOBS,
            variables: {fullPath: this.getHomeProjectPath}
        })

        for(const pipeline of result.data.project.pipelines.nodes || []) {
            const pipelineId = pipeline.id.split('/').pop()
            for(const job of pipeline.jobs.nodes) {
                const jobId = job.id.split('/').pop()
                const status = job.status

                Vue.set(this.jobsByPipelineId, pipelineId, {id: jobId, status})
            }
        }


    }
}
</script>
<template>
    <div ref="container" class="deployment-index-table" :class="{transition}">
        <gl-modal
            modalId="deployment-index-table"
            :title="modalTitle"
            v-model="modal"
            size="sm"
            :actionPrimary="{text: 'Confirm'}"
            :actionCancel="{text: 'Cancel'}"
            @primary="onModalConfirmed"
            />
        <table-component :noMargin="noMargin" :hideFilter="hideFilter" :useCollapseAll="false" :items="items" :fields="fields" :row-class="rowClass">
            <template #status="scope">
            </template>
            <template #deployment$head>
                <div class="ml-2">
                    {{__('Deployment')}}
                </div>
            </template>
            <template #deployment="scope">
                <div class="d-flex">
                    <div v-if="scope.item.context.deployment && Array.isArray(scope.item.context.deployment.statuses)" class="d-flex ml-2 mr-1 align-items-center">
                        <StatusIcon :size="16" v-if="!statuses(scope).length" :status="1" />
                        <StatusIcon :size="16" :key="status.name" v-for="status in statuses(scope)" :status="status.status" />
                    </div>
                    <div v-else-if="hasDeployPath(scope)" class="d-flex ml-2 mr-1 align-items-center">
                        <gl-icon name="pencil-square" :size="16" />
                    </div>
                    <div v-else class="d-flex ml-2 mr-1 align-items-center">
                        <gl-icon :name="`status_${deploymentItem(scope, 'jobStatus')}`" :size="16" />
                    </div>

                    <div v-if="scope.item.context.application" style="display: flex; flex-direction: column;" :class="{'hash-fragment': `#${scope.item.context.deployment.name}` == $route.hash}">
                        <a :href="`/${scope.item.context.application.projectPath}`">
                            <b> {{scope.item.context.application.title}}: </b>
                        </a>
                        <component 
                            v-if="scope.item.context.deployment"
                            :id="deploymentNameId(scope.item.context.deployment.name)"
                            :is="scope.item.context.deployment.__typename != 'DeploymentTemplate' && noRouter? 'a': 'router-link'"
                            v-bind="deploymentAttrs(scope)"
                            >
                            {{scope.item.context.deployment.title}}
                        </component>
                    </div>
                </div>
            </template>
            <template #resource$empty="scope">
                <div v-if="hasDeployPath(scope)">{{__('Not yet deployed')}}</div>
            </template>
            <template #resource="scope">
                <resource-cell v-if="scope.item.context.deployment" :noRouter="noRouter" :resource="scope.item.context.resource" :deployment="scope.item.context.deployment" :environment="scope.item.context.environment"/>
            </template>
            <template #environment="scope">
                <environment-cell :noRouter="noRouter" :environment="scope.item.context.environment"/>
            </template>
            <template #last-deploy$all="scope">
                <div v-if="scope.item._depth == 0">
                    {{deploymentItem(scope, 'createdAtText')}}
                    <div style="height: 0;" v-if="deploymentItem(scope, 'createdAt')">
                        <div style="font-size: 0.95em; position: absolute; top: -2px;">
                            <span v-if="deploymentItem(scope, 'consoleLink')">
                                <a :href="deploymentItem(scope, 'consoleLink')">View Job {{deploymentItem(scope, 'jobStatusMessage')}}</a> /
                                <a :href="deploymentItem(scope, 'artifactsLink')">View Artifacts</a>
                            </span>
                        </div>
                    </div>
                </div>

            </template>

            <template #controls$head> <div></div> </template>
            <template #controls$all="scope">
                <deployment-controls @startDeployment="onIntentToStart" @stopDeployment="onIntentToStop" @deleteDeployment="onIntentToDelete" v-if="scope.item._depth == 0" :scope="scope" :resumeEditingLink="resumeEditingLink(scope)" />
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
