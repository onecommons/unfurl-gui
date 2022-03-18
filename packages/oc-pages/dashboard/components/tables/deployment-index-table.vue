<script>
import TableComponent from '../../../vue_shared/components/oc/table.vue'
import StatusIcon from '../../../vue_shared/components/oc/Status.vue';
import EnvironmentCell from '../cells/environment-cell.vue'
import ResourceCell from '../cells/resource-cell.vue'
import {GlButton, GlIcon} from '@gitlab/ui'
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
        TableComponent, StatusIcon, EnvironmentCell, ResourceCell, GlButton, GlIcon
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
                groupBy: (item) => item.context.deployment?.name,
                textValue: () => '',
            },
        ]

        return {fields, routes}

    },
    methods: {
        statuses(scope) {
            return scope.item.context.deployment?.statuses || []
        },
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
            console.log({to})
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
    }


}
</script>
<template>
    <table-component :noMargin="noMargin" :hideFilter="hideFilter" :useCollapseAll="false" :items="items" :fields="fields">
        <template #status="scope">
            <div v-if="scope.item.context.deployment && Array.isArray(scope.item.context.deployment.statuses)" class="d-flex justify-content-center" style="left: 7px; bottom: 2px;">
                <StatusIcon :size="18" v-if="!statuses(scope).length" :status="1" />
                <StatusIcon :size="18" :key="status.name" v-for="status in statuses(scope)" :status="status.status" />
            </div>
            <div v-else class="d-flex justify-content-center" style="left: 7px; bottom: 2px;">
                <gl-icon name="pencil-square" :size="18" />
            </div>
        </template>
        <template #status$head>
            <div style="text-align: center;">
                {{__('Status')}}
            </div>
        </template>
        <template #deployment="scope">
            <div v-if="scope.item.context.application" style="display: flex; flex-direction: column;">
                <a :href="`/${scope.item.context.application.name}`">
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
            <div>
                <div v-if="scope.item.context.deployment && scope.item.context.application && scope.item._depth == 0" class="external-link-container">
                    <gl-button v-if="scope.item.context.deployment.__typename == 'DeploymentTemplate'" target="_blank" rel="noopener noreferrer" :href="$router.resolve(resumeEditingLink(scope).to).href" style="background-color: #eee"><gl-icon name="external-link"/> {{__('Resume')}} </gl-button>
                    <gl-button v-else target="_blank" rel="noopener noreferrer" :href="scope.item.context.application.livePreview" style="background-color: #eee"><gl-icon name="external-link"/> {{__('Open')}} </gl-button>
                </div>
            </div>
        </template>

    </table-component>
</template>
<style scoped>
.external-link-container >>> button {
    font-size: 1em;
    padding: 6px 9px;
    bottom: -2px
}
</style>
