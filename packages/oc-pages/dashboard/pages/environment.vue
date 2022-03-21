<script>
import * as routes from '../router/constants'
import {mapActions, mapGetters, mapMutations} from 'vuex'
import DashboardBreadcrumbs from '../components/dashboard-breadcrumbs.vue'
import {GlFormInput, GlButton, GlIcon} from '@gitlab/ui'
import {CiVariableSettings, OcPropertiesList, DeploymentResources} from '../../vue_shared/oc-components'
import { __ } from '~/locale'
import {lookupCloudProviderAlias, slugify} from '../../vue_shared/util.mjs'
import {deleteEnvironment} from '../../vue_shared/client_utils/environments'


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
    components: {CiVariableSettings, DashboardBreadcrumbs, OcPropertiesList, GlFormInput, GlButton, GlIcon, DeploymentResources},
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
            'hasPreparedMutations'
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
                default: return __('Self hosted')
            }
        },
        saveStatus() {
            if(!this.hasPreparedMutations) {
                return 'disabled'
            }
            return 'display'
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
        },
        onSaveTemplate() {
            const environment = this.environment
            this.setUpdateObjectPath('environments.json')
            this.setUpdateObjectProjectPath(this.getHomeProjectPath)
            const ResourceType = this.environmentResourceTypeDict(environment)
            const root = {
                DeploymentEnvironment: {
                    [environment.name]: environment
                },
                ResourceType 
            }
            this.useProjectState({root})
            this.useBaseState(root)
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
        }
    },

    beforeMount() {
        const environmentName = this.$route.params.name
        const environment = this.lookupEnvironment(environmentName)
        this.environment = environment
        this.setAvailableResourceTypes(
            this.environmentLookupDiscoverable(environment)
        )

        this.onSaveTemplate()
        this.populateTemplateResources2({resourceTemplates: environment.instances, environmentName, context: 'environment'})


    }
}
</script>
<template>
    <div>
        <dashboard-breadcrumbs :items="breadcrumbItems" />
        <div class="mt-6"></div>
        <h2>{{__('Environment Name')}}</h2>
        <gl-form-input :style="width" :value="environment.name" disabled/>
        <h2>{{__('Cloud Provider')}}</h2>
        <oc-properties-list :header="cloudProviderDisplayName" :containerStyle="{'font-size': '0.9em', ...width}" :properties="propviderProps" />
        <h2>{{__('Variables')}}</h2>
        <ci-variable-settings v-if="!unfurl_gui"/>
        <deployment-resources @saveTemplate="onSaveTemplate" @deleteResource="onDelete" :save-status="saveStatus" delete-status="display" @addTopLevelResource="onExternalAdded" ref="deploymentResources" :external-status-indicator="true">
            <template #header>
                <!-- potentially tricky to translate -->
                <div class="d-flex align-items-center">
                    <h2 style="margin: 0 1.25em">{{__('External Resources used by')}} <span style="font-weight: 400">{{environment.name}}</span></h2>
                </div>
            </template>
            <template #primary-controls>
                <div class="confirm-container">
                    <gl-button variant="confirm" @click="() => $refs.deploymentResources.promptAddExternalResource()">
                        <div>
                            <gl-icon name="plus"/>
                            {{__('Add External Resource')}}
                        </div>
                    </gl-button>
                </div>

            </template>
            <!--template #controls>
                <div class="external-resource-controls">
                    <gl-button>
                        <div class="d-flex align-items-center">
                            <svg width="16" height="16" viewBox="0 0 15 17" stroke="#DBDBDB;" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path fill-rule="evenodd" clip-rule="evenodd" d="M4.26558 2.04999C4.26558 0.917811 5.20857 0 6.37181 0H8.47805C9.64129 0 10.5843 0.917811 10.5843 2.04999V3.07498H13.7436C14.3252 3.07498 14.7967 3.53389 14.7967 4.09998C14.7967 4.66606 14.3252 5.12497 13.7436 5.12497H13.5816L12.8401 14.5071C12.7557 15.5752 11.8407 16.3999 10.7401 16.3999H4.10979C3.0092 16.3999 2.09417 15.5752 2.00976 14.5071L1.26825 5.12497H1.10623C0.524613 5.12497 0.0531158 4.66606 0.0531158 4.09998C0.0531158 3.53389 0.524612 3.07498 1.10623 3.07498H4.26558V2.04999ZM6.37181 3.07498H8.47805V2.04999H6.37181V3.07498ZM3.38071 5.12497L4.10979 14.3499L10.7401 14.3499L11.4692 5.12497H3.38071Z" fill="#4A5053"/>
                            </svg>
                            <div> {{__('Remove')}} </div>
                        </div>
                    </gl-button>
                </div>
            </template-->

        </deployment-resources>
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
