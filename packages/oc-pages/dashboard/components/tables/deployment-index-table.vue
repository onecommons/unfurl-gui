<script>
import TableComponent from '../../../vue_shared/components/oc/table.vue'
import StatusIcon from '../../../vue_shared/components/oc/Status.vue';
import EnvironmentCell from '../cells/environment-cell.vue'
import ResourceCell from '../cells/resource-cell.vue'
import * as routes from '../../router/constants'

function deploymentGroupBy(item) {
    const result = `${item.deployment.name}:${item.application.name}`
    return result
}

export default {
    components: {
        TableComponent, StatusIcon, EnvironmentCell, ResourceCell
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
                groupBy: deploymentGroupBy,
                textValue: (item) => item.deployment.statuses.map(resource => resource.name).join(' '),
                label: 'Status'
            },
            {key: 'deployment', textValue: deploymentGroupBy, label: 'Deployment'},
            {
                key: 'environment',
                label: 'Environment',
                groupBy: (item) => item.environment.name
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
                textValue: (item) => item.resource.title,
                groupBy: (item) => item.resource.name,
                s: 'Resource'
            },
        ]

        return {fields, routes}

    }


}
</script>
<template>
    <table-component :items="items" :fields="fields">
        <template #status="scope">
            <StatusIcon :key="status.name" v-for="status in scope.item.context.deployment.statuses" :status="status.status" />
        </template>
        <template #deployment="scope">
            <div style="display: flex; flex-direction: column;">
                <router-link 
                 :to="{name: routes.OC_DASHBOARD_APPLICATIONS, params: {name: scope.item.context.application.name}}">
                    {{scope.item.context.application.title}}
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

    </table-component>
</template>
