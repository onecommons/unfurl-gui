<script>
import TableComponent from '../../vue_shared/components/oc/table.vue';

//TODO use components/cells wherever possible
import StatusIcon from '../../vue_shared/components/oc/Status.vue';
import LogosCloud from '../../project_overview/components/shared/logos_cloud.vue'
import QuantityCard from '../components/quantity-card.vue'
import ProjectIcon from '../../vue_shared/components/oc/project-icon.vue'
//

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
    {key: 'type', groupBy(item) {return item.context.deployment.name + ':' + item.context.type}, label: 'Resource Types', s: 'Resource Type'},
    {key: 'resource', textValue: textValueFromKeys('resource.title', 'resource.name'), label: 'Resources', s: 'Resource'},
];

export default {
    name: 'TableComponentContainer',
    components: {TableComponent, StatusIcon, LogosCloud, QuantityCard, ProjectIcon, DashboardBreadcrumbs},
    data() {
        return { 
            routes,
            fields,
            items: [],
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
        tableItems() { return this.getDashboardItems.filter(item => item.application) }
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
                color="#f4f4f4"/>
            <quantity-card 
                :to="{name: routes.OC_DASHBOARD_ENVIRONMENTS_INDEX}"
                :count="environmentsCount"
                s="Environment"
                p="Environments"
                color="#f4f4f4"/>
        </div>
        <div class="d-flex">
            <quantity-card
                :to="{name: routes.OC_DASHBOARD_DEPLOYMENTS_INDEX, query: {show: 'running'}}"
                :count="runningDeploymentsCount"
                s="Running Deployment"
                p="Running Deployments"
                color="#e2fbeb"/>
            <!-- TODO figure out a better way to show stopped deployments -->
            <quantity-card
                :to="{name: routes.OC_DASHBOARD_DEPLOYMENTS_INDEX, query: {show: 'stopped'}}"
                :count="stoppedDeploymentsCount"
                s="Stopped Deployment"
                p="Stopped Deployments"
                color="#fff4f4"/>
        </div>
    </div>
    <TableComponent :items="tableItems" :fields="fields">
    <template #application="scope">
        <router-link :to="{name: routes.OC_DASHBOARD_APPLICATIONS, params: {name: scope.item.context.application.name}}">
            <div class="status-item">
                <project-icon :projectIcon="scope.item.application.projectIcon" />
                {{scope.item.context.application.title}}
            </div>
        </router-link>
    </template>
    <template #environment="scope">
        <router-link :to="{name: routes.OC_DASHBOARD_ENVIRONMENTS, params: {name: scope.item.context.environment.name}}">
            <div class="status-item">
                <logos-cloud :small=true :cloud="scope.item.context.environment.primary_provider.type"/> 
                {{scope.item.context.environment.name}}
            </div>
        </router-link>
    </template>
    <template #deployment="scope">
        <router-link :to="{name: routes.OC_DASHBOARD_DEPLOYMENTS, params: {name: scope.item.context.deployment.name, environment: scope.item.context.environment.name}}">
            <div class="status-item">
                <status-icon v-for="resource in scope.item.context.deployment.statuses" :key="resource.name" :status="resource.status"/>
                    {{scope.item.context.deployment.title}}
            </div>
        </router-link>
    </template>
    <template #resource="scope">
        <div class="status-item">
            <status-icon :status="scope.item.context.resource.status" />
            {{scope.item.context.resource.title}}
        </div>
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
