<script>
import TableComponent from 'oc/vue_shared/components/oc/table.vue'
import EnvironmentCell from '../cells/environment-cell.vue'
import ApplicationCell from '../cells/application-cell.vue'
import DeploymentCell from '../cells/deployment-cell.vue'
import EnvironmentStatus from '../cells/environment-status.vue'
import * as routes from '../../router/constants'
import {textValueFromKeys} from '../../dashboard-utils'

function deploymentGroupBy(item) {
    const result = `${item.deployment?.name}:${item.application?.name}`
    return result
}

export default {
    components: {
        TableComponent, EnvironmentCell, ApplicationCell, DeploymentCell, EnvironmentStatus
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
            key: 'environment',
                label: 'Environment',
                groupBy: (item) => item.environment.name
            },
            {
                key: 'application',
                textValue: textValueFromKeys('application.title', 'application.name'),
                label: 'Applications',
                s: 'Application'
            },
            {
                key: 'deployment',
                textValue: textValueFromKeys('deployment.title', 'deployment.name'),
                label: 'Deployments',
                s: 'Deployment'
            },

          /*
           * TODO figure out how to implement commit lookup
            {
                key: 'last-update',
                shallow: true,
                label: 'Last Update',
                textValue: () => '12/13/21',
            },
          */
            {
                key: 'status',
                label: 'State',
                tableBodyStyles: {'justify-content': 'flex-end'},
                groupBy: (item) => item.context.environment?.name,
                textValue: () => '',
            },

            /*
            {
                key: 'status',
                groupBy: deploymentGroupBy,
                textValue: (item) => (item.deployment?.statuses || []).map(resource => resource.name).join(' '),
                label: 'Status'
            },
             */
        ]

        return {fields, routes}

    }


}
</script>
<template>
    <table-component :items="items" :fields="fields">
        <template #status$head>
            <div style="text-align: center">
                {{__('Status')}}
            </div>
        </template>
        <!--template #status="scope">
            <div v-if="scope.item.context.deployment" class="d-flex justify-content-center" style="left: 7px; 2px;">
                <StatusIcon :size="18" :key="status.name" v-for="status in scope.item.context.deployment.statuses" :status="status.status" />
            </div>
        </template-->
        <template #deployment="scope">
            <deployment-cell
                :scope="scope"
                :deployment="scope.item.context.deployment"
                :environment="scope.item.context.environment"
                :displayStatus="false"
                />
        </template>
        <template #application="scope">
            <application-cell :application="scope.item.context.application" />
        </template>
        <template #environment="scope">
            <environment-cell :environment="scope.item.context.environment"/>
        </template>
        <template #status$all="scope">
            <environment-status v-if="scope.item._depth == 0" :scope="scope"/>
        </template>

    </table-component>
</template>
