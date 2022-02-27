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
        }
    },
    data() {
        const fields = [
            {
                key: 'status',
                tableBodyStyles: {'justify-content': 'center'},
                groupBy: deploymentGroupBy,
                textValue: (item) => (item.deployment?.statuses || []).map(resource => resource?.name || '').join(' '),
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
                shallow: true
            },
        ]

        return {fields, routes}

    }


}
</script>
<template>
    <table-component :useCollapseAll="false" :items="items" :fields="fields">
        <template #status="scope">
            <div v-if="scope.item.context.deployment && Array.isArray(scope.item.context.deployment.statuses)" class="d-flex justify-content-center" style="left: 7px; bottom: 2px;">
                <StatusIcon :size="18" :key="status.name" v-for="status in scope.item.context.deployment.statuses" :status="status.status" />
            </div>
        </template>
        <template #status$head>
            <div style="text-align: center;">
                {{__('Status')}}
            </div>
        </template>
        <template #deployment="scope">
            <div v-if="scope.item.context.application" style="display: flex; flex-direction: column;">
                <router-link 
                 :to="{name: routes.OC_DASHBOARD_APPLICATIONS, params: {name: scope.item.context.application.name}}">
                    <b> {{scope.item.context.application.title}}: </b>
                </router-link>
                <router-link 
                 :to="{name: routes.OC_DASHBOARD_DEPLOYMENTS, params: {environment: scope.item.context.environment.name, name: scope.item.context.deployment.name}}">
                    {{scope.item.context.deployment.title}}
                </router-link>
            </div>
        </template>
        <template #resource="scope">
            <resource-cell :resource="scope.item.context.resource"/>
        </template>
        <template #environment="scope">
            <environment-cell :environment="scope.item.context.environment"/>
        </template>

        <template #open$head> <div></div> </template>
        <template #open$all="scope">
            <div>
                <div class="external-link-container" v-if="scope.item._depth == 0">
                    <gl-button target="_blank" rel="noopener noreferrer" :href="scope.item.context.application.livePreview" style="background-color: #eee"><gl-icon name="external-link"/> {{__('Open')}} </gl-button>
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
