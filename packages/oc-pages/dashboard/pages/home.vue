<script>
import TableComponent from '../../vue_shared/components/oc/table.vue';
import StatusIcon from '../../vue_shared/components/oc/Status.vue';
import LogosCloud from '../../project_overview/components/shared/logos_cloud.vue'
import QuantityCard from '../components/quantity-card.vue'
import ProjectIcon from '../components/project-icon.vue'
import {mapGetters, mapActions} from 'vuex';
import _ from 'lodash';
import { __ } from '~/locale';
import {USER_HOME_PROJECT} from '../../vue_shared/util.mjs'
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
    {key: 'application', groupBy: (item) => item.application.name, label: 'Applications', s: 'Application'},
    {key: 'environment', groupBy: (item) => item.environment.name, label: 'Environments', s: 'Environment'},
    {key: 'deployment', groupBy: (item) => item.deployment.name, label: 'Deployments', s: 'Deployment'},
    {key: 'type', label: 'Resource Types', s: 'Resource Type'},
    {key: 'resource', groupBy: (item) => item.resource.name, label: 'Resources', s: 'Resource'},
    //{key: 'status', groupBy: 'name', label: __('Status')},
];

export default {
    name: 'TableComponentContainer',
    components: {TableComponent, StatusIcon, LogosCloud, QuantityCard, ProjectIcon},
    data() {
        return { 
            routes,
            fields,
            items: [],
            loaded: false,
            stoppedDeployments: 0,
            deployments: 0,
            applications: 0,
            environments: 0,

        };
    },

    computed: {
        ...mapGetters([
            'getApplicationBlueprint',
            'getDeploymentDictionaries',
            'getDeployment',
            'getResources',
            'resolveResourceTemplate',
            'resolveResourceType',
            'resolveDeploymentTemplate',
            'lookupEnvironment'
        ]),
    },

    methods: {
        ...mapActions([
            'useProjectState'
        ]),
        async loadDashboard() {
            this.loaded = false;
            await this.$store.dispatch('fetchEnvironments', {fullPath: `${window.gon.current_username}/${USER_HOME_PROJECT}`});
            const items = [];
            this.deployments = this.applications = this.environments = this.stoppedDeployments = 0
            let applicationNames = {}

            const groups = _.groupBy(this.getDeploymentDictionaries, '_environment');
            for(const environmentName in groups) {
                this.environments += 1
                const environment = this.lookupEnvironment(environmentName)
                for(const deploymentDict of groups[environmentName]) {
                    if(deploymentDict.Deployment) {

                        this.deployments += 1
                    }
                    this.useProjectState(_.cloneDeep(deploymentDict))
                    const deployment = this.getDeployment
                    deployment.statuses = deployment.resources.filter(resource => resource.status != 1)
                    const application = this.getApplicationBlueprint;
                    applicationNames[application.name] = true

                    for(const resource of this.getResources) {
                        const resourceTemplate = this.resolveResourceTemplate(resource.template);
                        const resourceType = this.resolveResourceType(resourceTemplate.type);

                        items.push({application, deployment, environment, environmentName, type: resourceType.title, resource});
                    }
                }
            }
            this.applications = Object.keys(applicationNames).length

            this.items = items;
            this.loaded = true;
        }
    },

    async beforeCreate() {
        //await this.$store.dispatch('fetchEnvironments', {fullPath: `${window.gon.current_username}/${USER_HOME_PROJECT}`});
    },

    async mounted() {
        await this.loadDashboard()
    }
};

</script>
<template>
<div>
    <div class="quantity-cards">
        <div style="display: flex;">
            <quantity-card 
                :to="{name: routes.OC_DASHBOARD_APPLICATIONS_INDEX}" 
                :count="applications" 
                s="Application" 
                p="Applications" 
                color="#f4f4f4"/>
            <quantity-card 
                :to="{name: routes.OC_DASHBOARD_ENVIRONMENTS_INDEX}"
                :count="environments"
                s="Environment"
                p="Environments"
                color="#f4f4f4"/>
        </div>
        <div style="display: flex">
            <quantity-card
                :to="{name: routes.OC_DASHBOARD_DEPLOYMENTS_INDEX}"
                :count="deployments"
                s="Running Deployment"
                p="Running Deployments"
                color="#e2fbeb"/>
            <!-- TODO figure out a better way to show stopped deployments -->
            <quantity-card
                :to="{name: routes.OC_DASHBOARD_DEPLOYMENTS_INDEX}"
                :count="stoppedDeployments"
                s="Stopped Deployment"
                p="Stopped Deployments"
                color="#fff4f4"/>
        </div>
    </div>
    <TableComponent v-if="loaded" :items="items" :fields="fields">
    <template #application="scope">
        <router-link :to="{name: routes.OC_DASHBOARD_APPLICATIONS, params: {name: scope.item.application.name}}">
            <div class="status-item">
                <project-icon :projectIcon="scope.item.application.projectIcon" />
                {{scope.item.application.title}}
            </div>
        </router-link>
    </template>
    <template #environment="scope">
        <router-link :to="{name: routes.OC_DASHBOARD_ENVIRONMENTS, params: {name: scope.item.environment.name}}">
            <div class="status-item">
                <logos-cloud :small=true :cloud="scope.item.environment.primary_provider.type"/> 
                {{scope.item.environment.name}}
            </div>
        </router-link>
    </template>
    <template #deployment="scope">
        <router-link :to="{name: routes.OC_DASHBOARD_DEPLOYMENTS, params: {name: scope.item.deployment.name}}">
            <div class="status-item">
                <status-icon v-for="resource in scope.item.deployment.statuses" :key="resource.name" :status="resource.status"/>
                    {{scope.item.deployment.title}}
            </div>
        </router-link>
    </template>
    <template #resource="scope">
        <div class="status-item">
            <status-icon :status="scope.item.resource.status" />
            {{scope.item.resource.title}}
        </div>
    </template>

    <template #status=scope>
        <StatusIcon :status="scope.item.status" />
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
