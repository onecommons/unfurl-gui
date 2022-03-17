<script>
import TableComponent from '../../vue_shared/components/oc/table.vue';

import QuantityCard from '../components/quantity-card.vue'
import ApplicationCell from '../components/cells/application-cell.vue'
import EnvironmentCell from '../components/cells/environment-cell.vue'
import DeploymentCell from '../components/cells/deployment-cell.vue'
import ResourceCell from '../components/cells/resource-cell.vue'

import DashboardBreadcrumbs from '../components/dashboard-breadcrumbs.vue'
import {textValueFromKeys} from '../dashboard-utils'
import {mapGetters} from 'vuex';
import _ from 'lodash';
import { __ } from '~/locale';
import * as routes from '../router/constants'



/*
* this is the shape that the items can be passed in NOTE the tooltips
const items = [
  {
    name: "C",
    type: "Compute",
    status: "degraded",
    project: "Project2",
    maintainer: "Andrew",
    deployment: 1,
    tooltips: {
      maintainer: 'What a tool?!'
    }
  },
]; 

*/

const fields = [
    {key: 'application', textValue: textValueFromKeys('application.title', 'application.name'), label: 'Applications', s: 'Application'},
    {key: 'environment', textValue: textValueFromKeys('environment.name'), label: 'Environments', s: 'Environment'},
    {key: 'deployment', textValue: textValueFromKeys('deployment.title', 'deployment.name'), label: 'Deployments', s: 'Deployment'},
    {key: 'type', groupBy(item) {return (item.context.deployment?.name || '') + ':' + (item.context?.type || '')}, label: 'Resource Types', s: 'Resource Type'},
    {key: 'resource', textValue: textValueFromKeys('resource.title', 'resource.name'), label: 'Resources', s: 'Resource'},
];

export default {
    name: 'TableComponentContainer',
    components: {
        TableComponent,
        QuantityCard,
        //ProjectIcon,
        DashboardBreadcrumbs,
        ApplicationCell,
        EnvironmentCell,
        DeploymentCell,
        ResourceCell
    },
    data() {
        return { 
            routes,
            //fields,
            //items: [],
            loaded: false,
        };
    },

    computed: {
        ...mapGetters([
            'getDashboardItems',
            'runningDeploymentsCount',
            'stoppedDeploymentsCount',
            'environmentsCount',
            'applicationsCount',
        ]),
        tableFields() {
            if(this.environmentsCount > 0 && this.applicationsCount == 0) {
                return fields.slice(1)
            } else {
                return fields
            }
        },
        tableItems() {
            return this.getDashboardItems//.filter(item => item.application)
        }
    },
};

</script>
<template>
<div>
    <dashboard-breadcrumbs />
    <div class="quantity-cards">
        <div class="d-flex">
            <quantity-card 
                :to="{name: routes.OC_DASHBOARD_HOME}" 
                :count="applicationsCount" 
                s="Application" 
                p="Applications" 
                color="#f4f4f4"
                create-link="/explore" />
            <quantity-card 
                :to="{name: routes.OC_DASHBOARD_ENVIRONMENTS_INDEX}"
                :count="environmentsCount"
                s="Environment"
                p="Environments"
                color="#f4f4f4"
                :create-link="{name: routes.OC_DASHBOARD_ENVIRONMENTS_INDEX, query: {create: null}}"/>
        </div>
        <div class="d-flex">
            <quantity-card
                :to="{name: routes.OC_DASHBOARD_DEPLOYMENTS_INDEX, query: {show: 'running'}}"
                :count="runningDeploymentsCount"
                s="Running Deployment"
                p="Running Deployments"
                color="#e2fbeb"
                create-link="/explore" />
            <!-- TODO figure out a better way to show stopped deployments -->
            <quantity-card
                :to="{name: routes.OC_DASHBOARD_DEPLOYMENTS_INDEX, query: {show: 'stopped'}}"
                :count="stoppedDeploymentsCount"
                s="Stopped Deployment"
                p="Stopped Deployments"
                color="#fff4f4"/>
        </div>
    </div>
    <TableComponent :items="tableItems" :fields="tableFields">
    <template #empty>
      <center class="mt-5" style="font-size: 1.3em;">
        You haven't deployed anything yet. Browse our <a href="/explore" target="_blank">Starter Application Blueprints</a> to get started!
      </center>
    </template>
    <template #application="scope">
        <application-cell :application="scope.item.context.application" />
    </template>
    <template #environment="scope">
        <environment-cell :environment="scope.item.context.environment" />
    </template>
    <template #deployment="scope">
        <deployment-cell :environment="scope.item.context.environment" :deployment="scope.item.context.deployment" />
    </template>
    <template #resource="scope">
        <resource-cell :environment="scope.item.context.environment" :deployment="scope.item.context.deployment" :resource="scope.item.context.resource" />
    </template>
    </TableComponent> 
</div>
</template>

<style scoped>
.status-item {
  display: flex;
  align-items: flex-end;
}

.quantity-cards {
  display: flex;
  justify-content: center;
  margin: 2em -0.5em 4em -0.5em;
  flex-wrap: wrap;
}

</style>
