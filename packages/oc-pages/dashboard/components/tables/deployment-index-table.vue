<script>
import TableComponent from '../../../vue_shared/components/oc/table.vue'
import StatusIcon from '../../../vue_shared/components/oc/Status.vue';
import EnvironmentCell from '../cells/environment-cell.vue'
import ResourceCell from '../cells/resource-cell.vue'
import DeploymentControls from '../cells/deployment-controls.vue'
import {GlButton, GlIcon, GlModal} from '@gitlab/ui'
import {undeploy} from '../../../vue_shared/client_utils/pipelines'
import {mapGetters, mapActions} from 'vuex'
import _ from 'lodash'
import * as routes from '../../router/constants'

function deploymentGroupBy(item) {

    let result 
    try{
        result = `${item.deployment.name}:${item.application.name}`
    } catch(e) {return }
    return result
}

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
            {
                key: 'status',
                tableBodyStyles: {'justify-content': 'center'},
                groupBy: deploymentGroupBy,
                textValue: (item) => '@' + (item.deployment?.statuses || []).map(resource => resource?.name || '').join(' '),
                label: 'Status'
            },
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
                key: 'open',
                label: 'Open',
                tableBodyStyles: {'justify-content': 'flex-end'},
                groupBy: (item) => item.context.deployment?.name,
                textValue: () => '',
            },
        ]

        const intent = '', target = null
        return {fields, routes, intent, target}

    },
    methods: {
        ...mapActions([
            'deleteDeployment'
        ]),
        deploy() { return this.deployInto(this.deploymentParameters) },
        undeploy() { return undeploy( this.pipelinesPath, this.deploymentParameters) },
        statuses(scope) { return _.uniqBy(scope.item.context.deployment?.statuses || [], resource => resource.status) },
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
        onModalConfirmed() {
            const {deployment, environment} = this.target
            switch(this.intent) {
                case 'undeploy':
                    this.undeploy()
                    return
                case 'deploy':
                    this.deploy()
                    return
                case 'delete':
                    this.deleteDeployment({deploymentName: deployment.name, environmentName: environment.name})
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
        hasDeployPath(scope) {
            return !this.lookupDeployPath(scope.item.context.deployment?.name, scope.item.context.environment?.name)?.pipeline?.id
        }
    },
    computed: {
        ...mapGetters(['pipelinesPath', 'UNFURL_MOCK_DEPLOY', 'lookupDeployPath']),
        deploymentParameters() {
            const {deployment, environment} = this.target
            const projectUrl = `${window.gon.gitlab_url}/${deployment.projectPath}.git`
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
            return `environments/${environment.name}/${deployment.projectPath}/${deployment.name}`
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
                default: return ''
            }
        }
    }
}
</script>
<template>
    <div class="deployment-index-table">
        <gl-modal
            modalId="deployment-index-table"
            :title="modalTitle"
            v-model="modal"
            size="sm"
            :actionPrimary="{text: 'Confirm'}"
            :actionCancel="{text: 'Cancel'}"
            @primary="onModalConfirmed"
            />
        <table-component :noMargin="noMargin" :hideFilter="hideFilter" :useCollapseAll="false" :items="items" :fields="fields">
            <template #status="scope">
                <div v-if="scope.item.context.deployment && Array.isArray(scope.item.context.deployment.statuses)" class="d-flex justify-content-center" style="left: 7px; bottom: 2px;">
                    <StatusIcon :size="18" v-if="!statuses(scope).length" :status="1" />
                    <StatusIcon :size="18" :key="status.name" v-for="status in statuses(scope)" :status="status.status" />
                </div>
                <div v-else-if="hasDeployPath(scope)" class="d-flex justify-content-center" style="left: 7px; bottom: 2px;">
                    <gl-icon name="pencil-square" :size="18" />
                </div>
                <div v-else  class="d-flex justify-content-center" style="left: 7px; bottom: 2px;">
                    <gl-icon name="stop" :size="18" />
                </div>
            </template>
            <template #status$head>
                <div style="text-align: center;">
                    {{__('Status')}}
                </div>
            </template>
            <template #deployment="scope">
                <div v-if="scope.item.context.application" style="display: flex; flex-direction: column;">
                    <a :href="`/${scope.item.context.application.projectPath}`">
                        <b> {{scope.item.context.application.title}}: </b>
                    </a>
                    <component v-if="scope.item.context.deployment" :is="scope.item.context.deployment.__typename != 'DeploymentTemplate' && noRouter? 'a': 'router-link'" v-bind="deploymentAttrs(scope)">
                        {{scope.item.context.deployment.title}}
                    </component>
                </div>
            </template>
            <template #resource="scope">
                <resource-cell v-if="scope.item.context.deployment" :noRouter="noRouter" :resource="scope.item.context.resource" :deployment="scope.item.context.deployment" :environment="scope.item.context.environment"/>
            </template>
            <template #environment="scope">
                <environment-cell :noRouter="noRouter" :environment="scope.item.context.environment"/>
            </template>

            <template #open$head> <div></div> </template>
            <template #open$all="scope">
                <deployment-controls @stopDeployment="onIntentToStop" @deleteDeployment="onIntentToDelete" v-if="scope.item._depth == 0" :scope="scope" :resumeEditingLink="resumeEditingLink(scope)" />
            </template>

        </table-component>
    </div>

</template>
<style>
[id^="deployment-index-table"].modal-body { min-height: 0; padding: 0; }
</style>
<style scoped>

.external-link-container >>> button {
    font-size: 1em;
    padding: 6px 9px;
    bottom: -2px
}
</style>
