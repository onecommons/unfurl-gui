<script>
import * as routes from '../router/constants'
import { FLASH_TYPES } from 'oc_vue_shared/client_utils/oc-flash'
import {mapActions, mapGetters, mapMutations} from 'vuex'
import DashboardBreadcrumbs from '../components/dashboard-breadcrumbs.vue'
import {GlFormInput, GlButton, GlIcon, GlTabs} from '@gitlab/ui'
import {OcTab, DetectIcon, CiVariableSettings, OcPropertiesList, DeploymentResources} from 'oc_vue_shared/oc-components'
import _ from 'lodash'
import { __ } from '~/locale'
import {lookupCloudProviderAlias, slugify} from 'oc_vue_shared/util.mjs'
import {deleteEnvironment} from 'oc_vue_shared/client_utils/environments'
import { redirectTo } from '~/lib/utils/url_utility';


const PROP_MAP = {
    primaryProviderGcpProjectId(value) {return {name: 'Project ID', value}},
    primaryProviderGcpZone(value) { return {name: 'Zone', value} },
    primaryProviderAwsRoleArn(value) { return {name: 'Role ARN', value}},
    primaryProviderAwsDefaultRegion(value) { return {name: 'Default region', value}},
}

function mapCloudProviderProps(ci_variables) {
    const result = []
    for(const variable in ci_variables) {
        const mapping = PROP_MAP[variable]
        if(typeof mapping == 'function') {
            const value = ci_variables[variable]
            const newProp = mapping(value)
            if(newProp) result.push(newProp)
        }
    }
    return result
}

export default {
    name: 'Environment',
    components: {OcTab, GlTabs, CiVariableSettings, DashboardBreadcrumbs, OcPropertiesList, GlFormInput, GlButton, GlIcon, DeploymentResources, DetectIcon},
    data() {
        const gcpProps = [
            {name: 'Status', value: 'Connected', valueStyle: {'font-weight': 'bold'}, icon: 'status_success_solid', outboundLink: 'https://youtube.com', outboundLinkText: 'Go to console'},
            {name: 'Zone', value: 'Value 1'},
            {name: 'Access Key', value: 'Value 2'},
            {name: 'Password', value: '**********'},
        ]
        const sendGridProps = [
            {name: 'Status', value: 'Running', valueStyle: {'font-weight': 'bold'}, icon: 'status_success_solid', outboundLink: 'https://youtube.com', outboundLinkText: 'View DB1 (on GCP)'},
            {name: 'Property 1', value: 'Value 1'},
            {name: 'Property 2', value: 'Value 2'},
            {name: 'Property 3', value: 'Value 3'},
        ]

        const width = {width: 'max(500px, 50%)'}
        return {environment: {}, gcpProps, sendGridProps, width, unfurl_gui: window.gon.unfurl_gui}
    },
    computed: {
        ...mapGetters([
            'lookupEnvironment',
            'environmentLookupDiscoverable',
            'environmentResourceTypeDict',
            'getHomeProjectPath',
            'hasPreparedMutations',
            'isMobileLayout',
            'getCardsStacked',
            'cardIsValid'
        ]),
        breadcrumbItems() {
            return [
                {to: {name: routes.OC_DASHBOARD_ENVIRONMENTS_INDEX}, text: 'Environments'},
                {text: this.environment?.name, href: '#'}
            ]
        },
        propviderProps() {
            return mapCloudProviderProps(this.$store.state.ci_variables)
        },
        cloudProviderDisplayName() {
            switch(this.environment?.primary_provider?.type) {
                case lookupCloudProviderAlias('gcp'):
                    return __('Google Cloud Platform')
                case lookupCloudProviderAlias('aws'):
                    return __('Amazon Web Services')
                case lookupCloudProviderAlias('azure'):
                    return __('Azure')
                case lookupCloudProviderAlias('k8s'):
                    return __('Kubernetes')
                case lookupCloudProviderAlias('DigitalOcean'):
                    return __('Digital Ocean')
                default: return __('Local development')
            }
        },
        saveStatus() {
            for(const card of this.getCardsStacked) {
                if(!this.cardIsValid(card)) return 'disabled'
            }
            if(!this.hasPreparedMutations) {
                return 'disabled'
            }
            return 'display'
        },
        providerType() {
            return this.environment?.primary_provider?.type
        },
        showDeploymentResources() {
            return this.getCardsStacked.length > 0 || this.hasPreparedMutations
        }
    },
    methods: {
        ...mapActions([
            'useProjectState',
            'populateTemplateResources2',
            'createNodeResource',
            'commitPreparedMutations',
        ]),


        ...mapMutations([
            'setEnvironmentScope',
            'setAvailableResourceTypes',
            'setUpdateObjectPath',
            'setUpdateObjectProjectPath',
            'useBaseState',
            'pushPreparedMutation',
            'setUpdateObjectPath',
            'setUpdateObjectProjectPath'
        ]),
        onExternalAdded({selection, title}) {
            this.createNodeResource({selection, name: slugify(title), title, isEnvironmentInstance: true})
            this.$refs.deploymentResources.cleanModalResource()
            this.$refs.deploymentResources.scrollDown(slugify(title))
        },
        onSaveTemplate(reload=true) {
            const environment = this.environment
            this.setUpdateObjectPath('environments.json')
            this.setUpdateObjectProjectPath(this.getHomeProjectPath)
            this.setEnvironmentScope(environment.name)

            if(reload) {
                window.location.reload()
            }
            else {
                // TODO this logic isn't working to reset everything properly
                // my intuition is that it's not correctly using the new external external resources after this is saved, so they end up being lost when the user attempts to save again
                const ResourceType = this.environmentResourceTypeDict(environment)
                const root = _.cloneDeep({
                    DeploymentEnvironment: {
                        [environment.name]: environment
                    },
                    ResourceType 
                })
                this.useProjectState({root})
                this.useBaseState(root)
            }
        },
        async onDelete() {
            const environment = this.environment
            
            await deleteEnvironment(window.gon.projectPath, window.gon.projectId, environment.name, window.gon.environmentId)

            this.setUpdateObjectProjectPath(window.gon.projectPath)
            this.setUpdateObjectPath('environments.json')

            this.pushPreparedMutation(function(accumulator) {
                return [ {typename: 'DeploymentEnvironment', target: environment.name, patch: null} ]
            })

            await this.commitPreparedMutations()
            sessionStorage['oc_flash'] = JSON.stringify({type: FLASH_TYPES.SUCCESS, message: `${environment.name} was deleted successfully.`})
            return redirectTo(this.$router.resolve({name: routes.OC_DASHBOARD_ENVIRONMENTS_INDEX}).href)
        }
    },

    beforeMount() {
        const environmentName = this.$route.params.name
        const environment = this.lookupEnvironment(environmentName)
        this.environment = environment
        this.setAvailableResourceTypes(
            this.environmentLookupDiscoverable(environment)
        )

        this.onSaveTemplate(false)
        this.populateTemplateResources2({resourceTemplates: environment.instances, environmentName, context: 'environment'})


    }
}
</script>
<template>
    <div>
        <dashboard-breadcrumbs :items="breadcrumbItems" />
        <div class="mt-6 row">
            <div class="col">
                <h2>{{__('Environment Name')}}</h2>
                <gl-form-input style="width: max(500px, 50%);" :value="environment.name" disabled/>
            </div>
        </div>
        <h2>{{__('Cloud Provider')}}</h2>
        <oc-properties-list :header="cloudProviderDisplayName" :containerStyle="{'font-size': '0.9em', ...width}" :properties="propviderProps">
            <template #header-text>
                <div class="d-flex align-items-center" style="line-height: 20px;">
                    <detect-icon :size="20" :env="environment" class="mr-1"/> {{cloudProviderDisplayName}}
                </div>
            </template>
        </oc-properties-list>
        <gl-tabs class="mt-4">
            <oc-tab title="Resources">
                <div class="d-flex" v-if="!showDeploymentResources">
                    <div class="mr-4">
                        <p>
                            External resources are third-party resources that already exist elsewhere that Unfurl Cloud connects to (i.e. a pre-existing DNS server, compute instance etc). Unfurl.cloud cannot delete or control the lifecycle of an external resource.
                        </p>
                        <p>
                            External resources are a convenient way to reuse configurations across many deployments.
                        </p>
                    </div>
                    <div>
                        <gl-button variant="confirm" @click="() => $refs.deploymentResources.promptAddExternalResource()">
                            <div>
                                <gl-icon name="plus"/>
                                {{__('Add External Resource')}}
                            </div>
                        </gl-button>
                    </div>
                </div>
                <deployment-resources v-show="showDeploymentResources" style="margin-top: -1.5rem;" @saveTemplate="onSaveTemplate" @deleteResource="onDelete" :save-status="saveStatus" delete-status="display" @addTopLevelResource="onExternalAdded" ref="deploymentResources" external-status-indicator display-validation>
                    <template #header>
                        <!-- potentially tricky to translate -->
                        <div class="d-flex align-items-center">
                            <h2 style="margin: 0 1.25em">{{__('External Resources used by')}} <span style="font-weight: 400">{{environment.name}}</span></h2>
                        </div>
                    </template>
                    <template #primary-controls>
                        <div v-if="!isMobileLayout" class="confirm-container">
                            <gl-button variant="confirm" @click="() => $refs.deploymentResources.promptAddExternalResource()">
                                <div>
                                    <gl-icon name="plus"/>
                                    {{__('Add External Resource')}}
                                </div>
                            </gl-button>
                        </div>
                    </template>
                    <template #primary-controls-footer>
                        <div v-if="isMobileLayout" class="confirm-container">
                            <gl-button variant="confirm" @click="() => $refs.deploymentResources.promptAddExternalResource()">
                                <div>
                                    <gl-icon name="plus"/>
                                    {{__('Add External Resource')}}
                                </div>
                            </gl-button>
                        </div>
                    </template>
                </deployment-resources>
            </oc-tab>
            <oc-tab title="Variables">
                <ci-variable-settings v-if="!unfurl_gui"/>
            </oc-tab>
        </gl-tabs>
        <div v-if="!showDeploymentResources" class="form-actions d-flex justify-content-end">
            <gl-button @click="$refs.deploymentResources.openModalDeleteTemplate()">
                <gl-icon name="remove"/>
                Delete Environment
            </gl-button>
        </div>
    </div>
</template>
<style scoped>
h2 {
    color: #4A5053;
    font-size: 1.25em;
    margin: 1.5em 0 0.5em 0;
    height: 1em;
}
.external-resource-controls >>> button {
    padding: 0.4em;
    margin: 0 0.25em;
}
.confirm-container {
    margin-left: auto;
}
.confirm-container >>> button {
    padding: 0.5em;
}
/*
input fill FAFAFA
input stroke DBDBDB
line width 1
*/
</style>
