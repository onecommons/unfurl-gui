<script>
import TableComponent from 'oc_vue_shared/components/oc/table.vue';
import MarkdownView from 'oc_vue_shared/components/oc/markdown-view.vue'

import QuantityCard from '../components/quantity-card.vue'
import ApplicationCell from '../components/cells/application-cell.vue'
import EnvironmentCell from '../components/cells/environment-cell.vue'
import DeploymentCell from '../components/cells/deployment-cell.vue'
import ResourceCell from '../components/cells/resource-cell.vue'

import DashboardBreadcrumbs from '../components/dashboard-breadcrumbs.vue'
import DashboardWelcome from '../components/dashboard-welcome.vue'
import {textValueFromKeys} from '../dashboard-utils'
import {mapGetters} from 'vuex';
import _ from 'lodash';
import { __ } from '~/locale';
import * as routes from '../router/constants'

import { GlMarkdown, GlCard, GlIcon } from '@gitlab/ui'

const standalone = window.gon.unfurl_gui

function pluralizeResourceType(count) {
  if(count == 0) return ''
}

function pluralizeResources(count) {
  if(count == 0) return 'No resources'
}
const fields = [
    {key: 'application', textValue: textValueFromKeys('application.title', 'application.projectPath'), label: 'Applications', s: 'Application'},
    {key: 'environment', textValue: textValueFromKeys('environment.name'), label: 'Environments', s: 'Environment'},
    {key: 'deployment', textValue: textValueFromKeys('deployment.title', 'deployment.name'), label: 'Deployments', s: 'Deployment'},
    {key: 'type', groupBy(item) {return (item.context.deployment?.name || '') + ':' + (item.context?.type || '')}, label: 'Resource Types', s: 'Resource Type', pluralize: pluralizeResourceType},
    {key: 'resource', textValue: textValueFromKeys('resource.title', 'resource.name'), label: 'Resources', s: 'Resource', pluralize: pluralizeResources},
];

export default {
    name: 'TableComponentContainer',
    components: {
        TableComponent,
        QuantityCard,
        DashboardBreadcrumbs,
        ApplicationCell,
        EnvironmentCell,
        DeploymentCell,
        ResourceCell,
        DashboardWelcome,
        GlMarkdown, GlCard, GlIcon,
        MarkdownView
    },
    data() {
        return {
            routes,
            //fields,
            //items: [],
            readme: window.gon.readme,
            readmeRaw: window.gon.readmeRaw,
            loaded: false,
            standalone,
        };
    },

    computed: {
        ...mapGetters([
            'getDashboardItems',
            'runningDeploymentsCount',
            'totalDeploymentsCount',
            'environmentsCount',
            'applicationsCount',
            'mergeRequests'
        ]),
        tableFields() {
            if(this.environmentsCount > 0 && this.applicationsCount == 0) {
                return fields.slice(1)
            } else {
                return fields
            }
        },
        tableItems() {
            let result = this.getDashboardItems
            if(this.totalDeploymentsCount > 0) {
                result = this.getDashboardItems.filter(item => !!item.context?.deployment)
            }
            return result
        },
        totalDeploymentsSecondary() {
            if(this.mergeRequests.length > 0) {
                return {
                    link: {name: routes.OC_DASHBOARD_DEPLOYMENTS_INDEX, query: {show: 'merge requests'}},
                    text: `${this.mergeRequests.length} Merge Request${this.mergeRequests.length == 1? '': 's'}`
                }
            } else {
                return {link: null, text: null}
            }
        }
    },
    mounted() {
        const cloneInstructions = document.querySelector('.gl-markdown a[href$="#clone-instructions"]')

        if(cloneInstructions) {
            cloneInstructions.href = '#clone-instructions'
        }
    }
};

</script>
<template>
<div>
    <dashboard-breadcrumbs />
    <div style="width: fit-content; margin: auto;">
        <dashboard-welcome v-if="totalDeploymentsCount == 0" />
        <div class="quantity-cards">
            <div class="d-flex flex-wrap justify-content-center">
                <quantity-card
                    :to="{name: routes.OC_DASHBOARD_HOME}"
                    :count="applicationsCount"
                    s="Application"
                    p="Applications"
                    class="qcard1"
                    :secondary-link="!standalone && '/projects/new#create_from_template'" />
                <quantity-card
                    :to="{name: routes.OC_DASHBOARD_ENVIRONMENTS_INDEX}"
                    :count="environmentsCount"
                    s="Environment"
                    p="Environments"
                    class="qcard2"
                    :secondary-link="!standalone && {name: routes.OC_DASHBOARD_ENVIRONMENTS_INDEX, query: {create: null}}"/>
            </div>
            <div class="d-flex flex-wrap justify-content-center">
                <quantity-card
                    :to="{name: routes.OC_DASHBOARD_DEPLOYMENTS_INDEX, query: {show: 'running'}}"
                    :count="runningDeploymentsCount"
                    s="Running Deployment"
                    p="Running Deployments"
                    class="qcard3"
                    secondary-link="#new-deployment" />
                <!-- TODO figure out a better way to show stopped deployments -->
                <quantity-card
                    :to="{name: routes.OC_DASHBOARD_DEPLOYMENTS_INDEX}"
                    :count="totalDeploymentsCount"
                    s="Total Deployment"
                    p="Total Deployments"
                    class="qcard4"
                    :secondary-link="totalDeploymentsSecondary.link"
                    :secondary-link-text="totalDeploymentsSecondary.text"
                    :secondary-link-requires-edit="false"
                 />
            </div>
        </div>
    </div>

    <TableComponent v-if="totalDeploymentsCount > 0" :items="tableItems" :fields="tableFields">
      <template #empty>
        <center class="my-5" style="font-size: 1.3em;">
          You haven't deployed anything yet. Browse our <a href="/explore/blueprints" target="_blank">Cloud Blueprints</a> to get started!
        </center>
      </template>
      <template #application="scope">
        <application-cell :application="scope.item.context.application" />
      </template>
      <template #environment="scope">
        <environment-cell :environment="scope.item.context.environment" />
      </template>
      <template #deployment="scope">
        <deployment-cell :scope="scope" :environment="scope.item.context.environment" :deployment="scope.item.context.deployment" />
      </template>
      <template #resource="scope">
        <resource-cell :environment="scope.item.context.environment" :deployment="scope.item.context.deployment" :resource="scope.item.context.resource" />
      </template>
    </TableComponent>

    <!-- card like on bluperint page -->
    <gl-card v-if="readme || readmeRaw" class="mt-6 consistent-card">
        <template #header>
            <div class="d-flex align-items-center">
                <gl-icon name="information-o" class="mr-2"/>
                <h5 class="mb-0 mt-0">
                    {{__('README.md')}}
                </h5>
            </div>
        </template>
        <gl-markdown v-if="readme" class="md" v-html="readme" />
        <markdown-view v-else :content="readmeRaw" />
    </gl-card>


    <!--gl-markdown class="mt-6" v-html="readme" /-->
</div>
</template>

<style scoped>

/* currently unused */
.gl-dark .consistent-card >>> .gl-card-header {
  background-color: #2F3030;
}

.consistent-card >>> .gl-card-header {
  background-color: #E3F7FF;
}

.gl-dark .consistent-card >>> .gl-card-body {
  background-color: rgb(18, 18, 18);
}

.consistent-card >>> .gl-card-body {
  background-color: white;
}

.quantity-cards {
  display: flex;
  justify-content: center;
  margin: 2em -0.5em 4em -0.5em;
  flex-wrap: wrap;
}

</style>
