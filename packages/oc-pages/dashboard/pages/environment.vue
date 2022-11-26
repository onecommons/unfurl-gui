<script>
import * as routes from '../router/constants'
import { FLASH_TYPES } from 'oc_vue_shared/client_utils/oc-flash'
import {mapActions, mapGetters, mapMutations} from 'vuex'
import DashboardBreadcrumbs from '../components/dashboard-breadcrumbs.vue'
import {GlFormInput, GlButton, GlIcon, GlTabs} from '@gitlab/ui'
import {Tooltip as ElTooltip} from 'element-ui'
import {OcTab, DetectIcon, CiVariableSettings, OcPropertiesList, DeploymentResources} from 'oc_vue_shared/oc-components'
import _ from 'lodash'
import { __ } from '~/locale'
import {lookupCloudProviderAlias, slugify} from 'oc_vue_shared/util.mjs'
import {deleteEnvironment} from 'oc_vue_shared/client_utils/environments'
import {notFoundError} from 'oc_vue_shared/client_utils/error'
import { redirectTo } from '~/lib/utils/url_utility';


const PROP_MAP = {
    primaryProviderGcpProjectId(value) {return {name: 'Project ID', value}},
    primaryProviderGcpZone(value) { return {name: 'Zone', value} },
    primaryProviderAwsRoleArn(value) { return {name: 'Role ARN', value}},
    primaryProviderAwsDefaultRegion(value) { return {name: 'Default region', value}},
    AWS_DEFAULT_REGION(value) { return {name: 'Default region', value}},
    AWS_ACCESS_KEY_ID(value) { return {name: 'Access key', value}}
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

    const deployPath = this.lookupDeployPath('primary_provider', this.environmentName)
    if(deployPath) {
        const jobId = this.jobByPipelineId(deployPath.pipeline.id)?.id
        console.log({jobId})
        if(jobId) {
            result.push({
                name: 'Created in',
                value: `Job #${jobId}`,
                url: `/${this.getHomeProjectPath}/-/jobs/${jobId}`,
            })
        }
    }

    return result
}

export default {
    name: 'Environment',
    components: {OcTab, GlTabs, CiVariableSettings, DashboardBreadcrumbs, OcPropertiesList, GlFormInput, GlButton, GlIcon, DeploymentResources, DetectIcon, ElTooltip},
    data() {
        const width = {width: 'max(500px, 50%)'}
        return {environment: {}, width, unfurl_gui: window.gon.unfurl_gui, currentTab: 0}
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
            'cardIsValid',
            'userCanEdit',
            'getVariables',
            'lookupDeployPath',
            'jobByPipelineId',
        ]),
        providerTabIndex() {
            if(this.hasProviderTab) return 0
            else return -1
        },
        resourcesTabIndex() {
            return this.providerTabIndex + 1
        },
        publicCloudTabIndex() {
            if(this.publicCloudResources.length > 0) {
                return this.resourcesTabIndex + 1
            }
            return -1
        },
        variablesTabIndex() {
            if(!this.userCanEdit) return -1
            else return Math.max(this.resourcesTabIndex, this.publicCloudTabIndex) + 1
        },
        breadcrumbItems() {
            return [
                {to: {name: routes.OC_DASHBOARD_ENVIRONMENTS_INDEX}, text: 'Environments'},
                {text: this.environment?.name, href: '#'}
            ]
        },
        propviderProps() {
            return mapCloudProviderProps.bind(this)({
                ...this.$store.state.ci_variables,
                ...this.getVariables(this.environment)
            })
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
        hasProviderTab() {
            const primaryProviderType = this?.environment?.primary_provider?.type
            const displayForProviderType = primaryProviderType && ![lookupCloudProviderAlias('gcp'), lookupCloudProviderAlias('aws')].includes(primaryProviderType)

            const displayForOtherProvider = this.getCardsStacked.some(card => card.name != 'primary_provider' && lookupCloudProviderAlias(card.type))

            return displayForProviderType || displayForOtherProvider
        },
        saveStatus() {
            if(!this.userCanEdit || this.showingPublicCloudTab) return 'hidden'
            for(const card of this.getCardsStacked) {
                if(!this.cardIsValid(card)) return 'disabled'
            }
            if(!this.hasPreparedMutations) {
                return 'disabled'
            }
            return 'display'
        },
        deleteStatus() {
            if(!this.userCanEdit) return 'hidden'
            else return 'display'
        },
        providerType() {
            return this.environment?.primary_provider?.type
        },
        showDeploymentResources() {
            return (this.getCardsStacked.filter(this.resourceFilter)).length > 0 || this.hasPreparedMutations
        },
        showingDeploymentResourceTab() {
            return this.currentTab != this.variablesTabIndex && this.currentTab != this.providerTabIndex
        },
        showingProviderTab() {
            return this.currentTab == this.providerTabIndex
        },
        showingResourcesTab() {
            return this.currentTab == this.resourcesTabIndex
        },
        publicCloudResources() {
            return this.getCardsStacked.filter(card => card.type == 'UnfurlUserDNSZone')
        },
        showingPublicCloudTab() {
            return this.currentTab == this.publicCloudTabIndex
        },
        resourceFilter() {
            const isProvider = (resource) => resource.name == 'primary_provider' || lookupCloudProviderAlias(resource.type)
            if(this.showingProviderTab) {
                return isProvider
            } else if(this.showingPublicCloudTab){
                return (resource) => !isProvider(resource) && this.publicCloudResources.includes(resource)
            } else {
                return (resource) => !isProvider(resource) && !this.publicCloudResources.includes(resource)
            }
        },
        environmentName() {
            return this.$route.params.name
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
        onProviderAdded({selection, title}) {
            this.createNodeResource({selection, name: slugify(title), title, isEnvironmentInstance: true})
            this.$refs.deploymentResources.cleanModalResource()

            // hoping this works in the vast majority of cases
            // the alternative seems to be to poll the DOM until this tab shows up
            setTimeout(
                () => {
                    this.currentTab = this.providerTabIndex
                    this.$refs.deploymentResources.scrollDown(slugify(title))
                }, 100
            )
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
        const environmentName = this.environmentName
        const environment = this.lookupEnvironment(environmentName)
        if(!environment) {
            notFoundError()
            return
        }
        this.environment = environment
        this.setAvailableResourceTypes(
            this.environmentLookupDiscoverable(environment)
        )

        this.onSaveTemplate(false)
        this.populateTemplateResources2({resourceTemplates: [...environment.instances, ...environment.connections], environmentName, context: 'environment'})


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
        <div v-if="userCanEdit" class="mt-3">
            <gl-button variant="confirm" @click="() => $refs.deploymentResources.promptAddProvider()">
                <div>
                    <gl-icon name="plus"/>
                    {{__('Add a Provider')}}
                </div>
            </gl-button>
        </div>

        <gl-tabs v-model="currentTab" class="mt-4">
            <oc-tab title="Provider" v-if="hasProviderTab"></oc-tab>
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
                    <div v-if="userCanEdit">
                        <gl-button variant="confirm" @click="() => $refs.deploymentResources.promptAddExternalResource()">
                            <div>
                                <gl-icon name="plus"/>
                                {{__('Add External Resource')}}
                            </div>
                        </gl-button>
                    </div>
                </div>
            </oc-tab>
            <oc-tab title="Public Cloud" v-if="publicCloudResources.length > 0"></oc-tab>
            <oc-tab title="Variables" v-if="userCanEdit">
                <ci-variable-settings v-if="!unfurl_gui"/>
            </oc-tab>
        </gl-tabs>
        <div v-if="(!(showDeploymentResources || showingProviderTab)) && userCanEdit" class="form-actions d-flex justify-content-end">
            <gl-button @click="$refs.deploymentResources.openModalDeleteTemplate()">
                <gl-icon name="remove"/>
                Delete Environment
            </gl-button>
        </div>
        <deployment-resources :readonly="!userCanEdit || showingPublicCloudTab" v-show="(showingDeploymentResourceTab && showDeploymentResources) || showingProviderTab" style="margin-top: -1.5rem;" @saveTemplate="onSaveTemplate" @deleteResource="onDelete" :save-status="saveStatus" :filter="resourceFilter" :delete-status="deleteStatus" @addTopLevelResource="onExternalAdded" @addProvider="onProviderAdded" ref="deploymentResources" external-status-indicator display-validation>
            <template v-if="!showingProviderTab" #header>
                <!-- potentially tricky to translate -->
                <div v-if="showingResourcesTab" class="d-flex align-items-center">
                    <h2 style="margin: 0 1.25em">
                        {{__('External Resources used by')}}
                        <span style="font-weight: 400">{{environment.name}}</span>
                        <el-tooltip v-if="showDeploymentResources">
                            <template #content>
                                <div style="max-width: 300px;">
                                    <p>
                                        External resources are third-party resources that already exist elsewhere that Unfurl Cloud connects to (i.e. a pre-existing DNS server, compute instance etc). Unfurl.cloud cannot delete or control the lifecycle of an external resource.
                                    </p>
                                    <p>
                                        External resources are a convenient way to reuse configurations across many deployments.
                                    </p>
                                </div>
                            </template>
                            <i class="el-icon-info"></i>
                        </el-tooltip>
                    </h2>
                </div>
                <div v-else-if="showingPublicCloudTab">
                    <h2 style="margin: 0 1.25em">Public Cloud Resources</h2>
                </div>
                <div></div>
            </template>
            <template #primary-controls>
                <div v-if="!showingProviderTab && !isMobileLayout && userCanEdit && showingResourcesTab" class="confirm-container">
                    <gl-button variant="confirm" @click="() => $refs.deploymentResources.promptAddExternalResource()">
                        <div>
                            <gl-icon name="plus"/>
                            {{__('Add External Resource')}}
                        </div>
                    </gl-button>
                </div>
            </template>
            <template #primary-controls-footer>
                <div v-if="!showingProviderTab && isMobileLayout" class="confirm-container">
                    <gl-button variant="confirm" @click="() => $refs.deploymentResources.promptAddExternalResource()">
                        <div>
                            <gl-icon name="plus"/>
                            {{__('Add External Resource')}}
                        </div>
                    </gl-button>
                </div>
            </template>
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
</style>
