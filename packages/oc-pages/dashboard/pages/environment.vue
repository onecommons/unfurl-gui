<script>
import * as routes from '../router/constants'
import { FLASH_TYPES } from 'oc_vue_shared/client_utils/oc-flash'
import {mapActions, mapGetters, mapMutations} from 'vuex'
import DashboardBreadcrumbs from '../components/dashboard-breadcrumbs.vue'
import {GlFormInput, GlButton, GlIcon, GlTabs, GlModal} from '@gitlab/ui'
import {Tooltip as ElTooltip} from 'element-ui'
import {OcTab, DetectIcon, CiVariableSettings, DeploymentResources} from 'oc_vue_shared/components/oc'
import _ from 'lodash'
import { __, n__ } from '~/locale'
import {lookupCloudProviderAlias, cloudProviderFriendlyName, slugify} from 'oc_vue_shared/util'
import {fetchDashboardProviders, deleteEnvironment} from 'oc_vue_shared/client_utils/environments'
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

export default {
    name: 'Environment',
    components: {
        OcTab,
        CiVariableSettings,
        DashboardBreadcrumbs,
        GlTabs, GlFormInput, GlButton, GlIcon, GlModal,
        DeploymentResources,
        DetectIcon,
        ElTooltip
    },
    data() {
        const width = {width: 'max(500px, 50%)'}
        return {environment: {}, width, unfurl_gui: window.gon.unfurl_gui, currentTab: 0, fetchedConnectable: false, fetchedProviders: false, isNewProvider: false}
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
            'getPrimaryCard',
            'cardIsValid',
            'userCanEdit',
            'getVariables',
            'getEnvironmentDefaults',
            'lookupDeployPath',
            'jobByPipelineId',
            'resolveResourceTypeFromAny',
            'getApplicationRoot',
            'providerTypesForEnvironment',
            'deploymentItemDirect',
        ]),
        resourcesTabIndex() {
            return 0
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
        providerProps() {
            return this.mapCloudProviderProps({
                ...this.$store.state.ci_variables,
                ...this.getVariables(this.environment)
            })
        },
        primaryProvider() {
            return this.getPrimaryCard
        },
        cloudProviderDisplayName() {
            // NOTE: hardcoded names
            return cloudProviderFriendlyName(this.primaryProvider?._localTypeName) || __('Generic')
        },
        cardsAreValid() {
            for(const card of this.getCardsStacked) {
                if(!this.cardIsValid(card)) return false
            }

            if(this.primaryProvider && !this.cardIsValid(this.primaryProvider)) {
                return false
            }

            return true
        },
        saveStatus() {
            if(!this.userCanEdit || this.showingPublicCloudTab) return 'hidden'

            if(!this.cardsAreValid) {
                return 'disabled'
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
        showDeploymentResources() {
            return (this.getCardsStacked.filter(this.resourceFilter)).length > 0 || this.hasPreparedMutations
        },
        showingDeploymentResourceTab() {
            return this.showingResourcesTab || this.showingPublicCloudTab
        },
        showingProviderModal: {
            get() { return this.$route.query.hasOwnProperty('provider') && !this.$route.query.provider },
            set(val) {
                const query = {...this.$route.query}
                if(val) { query.provider = null }
                else { delete query.provider }

                if(! _.isEqual(query, this.$route.query)) {
                    const loc = {...this.$route, query}
                    if(this.isNewProvider) { // try to prevent hijacking back button
                        this.$router.replace(loc)
                    } else {
                        this.$router.push(loc)
                    }
                }
            }
        },
        showingResourcesTab() {
            return this.currentTab == this.resourcesTabIndex
        },
        publicCloudResources() {
            // NOTE: hardcoded names
            return this.getCardsStacked.filter(card => card._localTypeName == 'UnfurlUserDNSZone')
        },
        showingPublicCloudTab() {
            return this.currentTab == this.publicCloudTabIndex
        },
        resourceFilter() {
            if(this.showingPublicCloudTab){
                return (resource) => !this.isProvider(resource) && this.publicCloudResources.includes(resource)
            } else {
                return (resource) => !this.isProvider(resource) && !this.publicCloudResources.includes(resource)
            }
        },
        environmentName() {
            return this.$route.params.name
        },
        additionalProviders() {
            return this.getCardsStacked.filter(card => card.name != 'primary_provider' && lookupCloudProviderAlias(card._localTypeName))
        },
        editableProviders() {
            if(!this.primaryProvider || [lookupCloudProviderAlias('gcp'), lookupCloudProviderAlias('aws')].includes(this.primaryProvider._localTypeName)) {
                return this.additionalProviders
            }
            else return [this.primaryProvider, ...this.additionalProviders]
        }
    },
    methods: {
        ...mapActions([
            'useProjectState',
            'populateEnvironmentResources',
            'createNodeResource',
            'commitPreparedMutations',
            'normalizeUnfurlData',
            'environmentFetchTypesWithParams',
        ]),


        ...mapMutations([
            'setEnvironmentScope',
            'setAvailableResourceTypes',
            'useBaseState',
            'pushPreparedMutation',
            'clearPreparedMutations',
            'resetTemplateResourceState',
            'setUpdateType',
            'setDeploymentTemplate',
            'setUpdateObjectProjectPath',
            'clientDisregardUncommitted'
        ]),
        onExternalAdded({selection, title}) {
            this.createNodeResource({selection, name: slugify(title), title, isEnvironmentInstance: true})
            this.$refs.deploymentResources.cleanModalResource()
            this.$refs.deploymentResources.scrollDown(slugify(title))
        },
        scrollToProvider(name) {
            // hoping this works in the vast majority of cases
            // the alternative seems to be to poll the DOM until this tab shows up
            this.showingProviderModal = true
            setTimeout(
                () => {
                    this.$refs.deploymentResources.scrollDown(name)
                }, 100
            )

        },
        async onProviderAdded({selection, name, title}, fresh=false, clientDisregardUncommitted=false) {
            if(!fresh) await this.freshState()
            await this.createNodeResource({selection, name: name || slugify(title), title, isEnvironmentInstance: true})
            if(selection._localName == lookupCloudProviderAlias('k8s')) {
                await this.createNodeResource({
                    selection: this.resolveResourceTypeFromAny('KubernetesIngressController'),
                    title: "KubernetesIngressController",
                    name: "k8sDefaultIngressController",
                })
            }

            if(clientDisregardUncommitted) this.clientDisregardUncommitted()

            this.$refs.deploymentResources.cleanModalResource()

            this.scrollToProvider(slugify(title))
        },
        async onSaveProviderTemplate(...args) {
            this.showingProviderModal = false
            let redirect
            if(redirect = sessionStorage['redirectOnProviderSaved']) {
                delete sessionStorage['redirectOnProviderSaved']
                window.location.href = redirect
            }
            else {
                await this.onSaveTemplate(...args)
            }
        },
        async onSaveTemplate(reload=true) {
            const environment = this.environment
            this.setUpdateType('environment')
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
                        [environment.name]: environment,
                        defaults: this.getEnvironmentDefaults
                    },
                    ResourceType
                })
                await this.useProjectState({root})
                this.useBaseState(root)
            }
        },
        async onDelete() {
            const environment = this.environment

            this.setUpdateObjectProjectPath(window.gon.projectPath)
            this.setUpdateType('delete-environment')

            this.pushPreparedMutation(function(accumulator) {
                return [ {typename: 'DeploymentEnvironment', target: environment.name, patch: null} ]
            })

            await this.commitPreparedMutations()

            await deleteEnvironment(window.gon.projectPath, window.gon.projectId, environment.name, window.gon.environmentId)

            sessionStorage['oc_flash'] = JSON.stringify({type: FLASH_TYPES.SUCCESS, message: `${environment.name} was deleted successfully.`})
            return redirectTo(this.$router.resolve({name: routes.OC_DASHBOARD_ENVIRONMENTS_INDEX}).href)
        },

        headerTitle(provider) {
            if(!provider) return null
            return provider.name == 'primary_provider'? this.cloudProviderDisplayName : provider.title
        },

        schema(provider) {
            if(!provider) return null
            return this.resolveResourceTypeFromAny(provider.type)?.inputsSchema
        },

        isProvider(resource) {
            // NOTE: hardcoded names
            return resource.name == 'primary_provider' || lookupCloudProviderAlias(resource._localTypeName)
        },

        lookupCloudProviderAlias,

        async freshState() {
            this.clearPreparedMutations()

            const environmentName = this.environmentName
            const environment = this.lookupEnvironment(environmentName)
            if(!environment) {
                notFoundError()
                return
            }
            this.environment = environment

            await this.onSaveTemplate(false)

            const instances = _.cloneDeep(Object.values(environment.instances))
            const connections = _.cloneDeep(Object.values(environment.connections))

            await Promise.all(
                [
                    ...instances.map(entry => this.normalizeUnfurlData({key: 'ResourceTemplate', entry, projectPath: this.getHomeProjectPath, root: this.getApplicationRoot})),
                    this.$route.query.hasOwnProperty('newProvider')? this.fetchProviders(): null
                ]
            )
            // TODO implement and test normalization for connections - this should account better for users making manual changes

            await this.populateEnvironmentResources({
                resourceTemplates: [
                    ...instances,
                    ...connections
                ],
                environmentName,
                context: 'environment'
            })

            if(connections.length == 0) {
                const providers = (await fetchDashboardProviders(this.getHomeProjectPath)).providersByEnvironment[environmentName]
                if(providers?.length) {
                    // cheat to force agreement on primary card
                    this.setDeploymentTemplate({primary: 'primary_provider'})
                    this.isNewProvider = true
                    await this.fetchProviders()
                    await this.onProviderAdded({
                        title: 'Primary Provider',
                        name: 'primary_provider',
                        selection: this.resolveResourceTypeFromAny(providers[0]),
                    }, true, true)
                }
            }

            this.setAvailableResourceTypes(this.environmentLookupDiscoverable(environment))
        },

        onHide(e) {
            if(this.showingProviderModal) {
                e.preventDefault()
                if(this.isNewProvider) {
                    return
                }
            }
            this.showingProviderModal = false
        },

        async fetchProviders() {
            if(!this.fetchedProviders) {
                try {
                    await this.environmentFetchTypesWithParams({environmentName: this.environment.name, params: {extends: "tosca.relationships.ConnectsTo"}})
                    this.fetchedProviders = true
                } catch(e) {
                    console.error(e)
                }
            }
        },

        async addProvider() {
            await this.fetchProviders()

            this.$refs.deploymentResources.promptAddProvider()
        },

        async addExternalResources() {
            if(!this.fetchedConnectable) {
                try {
                    await this.environmentFetchTypesWithParams({environmentName: this.environment.name, params: {implements: ['connect'], implementation_requirements: this.providerTypesForEnvironment(this.environment)}})
                    this.setAvailableResourceTypes(this.environmentLookupDiscoverable(this.environment))
                    this.fetchedConnectable = true
                } catch(e) {
                    console.error(e)
                }
            }

            this.$refs.deploymentResources.promptAddExternalResource()
        },
        mapCloudProviderProps(ci_variables) {
            const result = []
            for(const variable in ci_variables) {
                const mapping = PROP_MAP[variable]
                if(typeof mapping == 'function') {
                    const value = ci_variables[variable]
                    const newProp = mapping(value)
                    if(newProp) result.push(newProp)
                }
            }


            const deploymentItem = this.deploymentItemDirect({
                deployment: 'primary_provider',
                environment: this.environmentName
            })

            if(deploymentItem) {
                const pipeline = deploymentItem.pipeline
                const jobId = this.jobByPipelineId(pipeline?.id)?.id
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

    },
    watch: {
        async showingProviderModal(val) {
            if(!val) {
                await this.freshState()
                this.$refs.providerModal.close()
            }
        }
    },

    async created() {
        await this.freshState()
    }
}
</script>
<template>
    <div class="environment">
        <dashboard-breadcrumbs :items="breadcrumbItems" />
        <div class="mt-6 row">
            <div class="col">
                <h2>{{__('Environment Name')}}</h2>
                <gl-form-input style="width: max(500px, 50%);" :value="environment.name" disabled/>
            </div>
        </div>
        <h2>{{n__('Cloud Provider', 'Cloud Providers', 1 + additionalProviders.length)}}</h2>
        <oc-properties-list
            :header="cloudProviderDisplayName"
            :containerStyle="{'font-size': '0.9em', ...width}"
            :properties="providerProps"
            v-if="!environment.primary_provider || [lookupCloudProviderAlias('gcp'), lookupCloudProviderAlias('aws')].includes(environment.primary_provider.type)"
        >
            <template #header-text>
                <div class="d-flex align-items-center" style="line-height: 20px;">
                    <detect-icon :size="20" :type="primaryProvider && primaryProvider._localTypeName" class="mr-1"/> {{cloudProviderDisplayName}}
                </div>
            </template>
        </oc-properties-list>
        <oc-properties-list
            v-for="p in editableProviders"
            :key="p.name"
            :header="headerTitle(p)"
            :containerStyle="{'font-size': '0.9em', ...width}"
            :properties="p.properties"
            :schema="schema(p)"
            class="mt-3"
        >
            <template #header-text>
                <div class="d-flex align-items-center" style="line-height: 20px;">
                    <detect-icon :size="20" :type="p._localTypeName" class="mr-1"/> {{headerTitle(p)}}
                </div>
            </template>
            <template v-if="userCanEdit" #header-controls>
                <gl-button @click.stop="scrollToProvider(p.name)">
                    <div class="d-flex">
                        <detect-icon name="pencil" :size="18" /> <span>Edit</span>
                    </div>
                </gl-button>
            </template>
        </oc-properties-list>
        <div v-if="userCanEdit" class="mt-3">
            <gl-button variant="confirm" @click="addProvider">
                <div>
                    <gl-icon name="plus"/>
                    {{__('Add a Provider')}}
                </div>
            </gl-button>
        </div>

        <gl-tabs v-model="currentTab" class="mt-4">
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
                        <gl-button variant="confirm" @click="addExternalResources">
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
        <div v-if="(!showDeploymentResources) && userCanEdit" class="form-actions d-flex justify-content-end">
            <gl-button @click="$refs.deploymentResources.openModalDeleteTemplate()">
                <gl-icon name="remove"/>
                Delete Environment
            </gl-button>
        </div>
        <deployment-resources
            :readonly="!userCanEdit || showingPublicCloudTab"
            v-show="(showingDeploymentResourceTab && showDeploymentResources)"
            style="margin-top: -1.5rem;"
            @saveTemplate="onSaveTemplate"
            @deleteResource="onDelete"
            :save-status="saveStatus"
            :filter="resourceFilter"
            :delete-status="deleteStatus"
            @addTopLevelResource="onExternalAdded"
            @addProvider="onProviderAdded"
            ref="deploymentResources"
            external-status-indicator
            display-validation
        >
            <template #header>
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
                <div v-else-if="showingPublicCloudTab" class="d-flex align-items-center">
                    <h2 style="margin: 0 1.25em">Public Cloud Resources</h2>
                </div>
                <div></div>
            </template>
            <template #primary-controls>
                <div v-if="!isMobileLayout && userCanEdit && showingResourcesTab" class="confirm-container">
                    <gl-button variant="confirm" @click="addExternalResources">
                        <div>
                            <gl-icon name="plus"/>
                            {{__('Add External Resource')}}
                        </div>
                    </gl-button>
                </div>
            </template>
            <template #primary-controls-footer>
                <div v-if="isMobileLayout" class="confirm-container">
                    <gl-button variant="confirm" @click="addExternalResources">
                        <div>
                            <gl-icon name="plus"/>
                            {{__('Add External Resource')}}
                        </div>
                    </gl-button>
                </div>
            </template>
        </deployment-resources>

        <!-- v-model doesn't work on this stupid component -->
        <gl-modal :visible="showingProviderModal" @hide="onHide" modalId="providerModal" ref="providerModal" size="lg" :hide-header="isNewProvider" :hide-footer="true">

            <deployment-resources :class="{'mt-2': isNewProvider}" @saveTemplate="onSaveProviderTemplate" @deleteResource="onDelete" :save-status="saveStatus" :filter="isProvider" :delete-status="deleteStatus"  ref="providerResources" external-status-indicator display-validation />


        </gl-modal>
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

.environment >>> td.name-column {
    width: 11em;
}

.environment >>> td.value-column {
    width: calc(max(500px, 50%) - 11em);
}

</style>
