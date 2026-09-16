<script>
import * as routes from '../router/constants'
import { FLASH_TYPES } from 'oc_vue_shared/client_utils/oc-flash'
import {mapActions, mapGetters, mapMutations} from 'vuex'
import DashboardBreadcrumbs from '../components/dashboard-breadcrumbs.vue'
import {GlFormInput, GlButton, GlIcon, GlTabs, GlModal, GlPopover} from '@gitlab/ui'
import {OcTab, DetectIcon, CiVariableSettings, DeploymentResources} from 'oc_vue_shared/components/oc'
import _ from 'lodash'
import { __, n__ } from '~/locale'
import {lookupCloudProviderAlias, cloudProviderFriendlyName, slugify, STD_REPOSITORY_URL} from 'oc_vue_shared/util'
import {projectPathToHomeRoute} from 'oc_vue_shared/client_utils/dashboard'
import {fetchDashboardProviders, deleteEnvironment} from 'oc_vue_shared/client_utils/environments'
import {fetchProvider, deleteProvider} from 'oc_vue_shared/client_utils/environment-providers'
import {defineAsyncComponent} from 'vue'
import {notFoundError} from 'oc_vue_shared/client_utils/error'
import {mapProviderProps} from './provider-props'
import { visitUrl } from '~/lib/utils/url_utility';



const PROVIDER_SETUP_PANELS = ['aws', 'gcp']

// Temporarily off: "Add a provider connection" does not work well enough on an
// environment that already has one -- see cypress/README.md. The modal and its
// handlers are left in place; only the way in is hidden, so restoring it is
// this flag.
const ADD_PROVIDER_ENABLED = false

const standalone = window.gon.unfurl_gui

export default {
    name: 'Environment',
    components: {
        OcTab,
        CiVariableSettings,
        DashboardBreadcrumbs,
        GlTabs, GlFormInput, GlButton, GlIcon, GlModal, GlPopover,
        DeploymentResources,
        DetectIcon,
        // Only the setup path needs these, and between them they carry the
        // region and zone lists and Google's button image set.
        AwsProviderSetup: defineAsyncComponent(() => import('../components/aws-provider-setup.vue')),
        GcpProviderSetup: defineAsyncComponent(() => import('../components/gcp-provider-setup.vue'))
    },
    data() {
        const width = {width: 'max(500px, 50%)'}
        return {environment: {}, width, currentTab: 0, fetchedConnectable: false, fetchedProviders: false, isNewProvider: false, standalone, providerRecorded: false, providerRecord: null, variablesLoaded: false, savingProvider: false}
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
                ...(this.providerRecord || {}),
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
        // gcp and aws collect their credentials in a panel of their own; the query
        // names which one, and the page is theirs until it is saved or cancelled.
        providerSetup() {
            const provider = this.$route.query.provider
            // providerRecorded suppresses the panel for a provider that already
            // exists, so that saving one does not drop the user straight back
            // into setup. `editProvider` is the user asking for it on purpose --
            // otherwise gcp and aws have no edit path at all, since
            // editableProviders leaves their primary out.
            if(this.providerRecorded && !this.$route.query.hasOwnProperty('editProvider')) return null
            return PROVIDER_SETUP_PANELS.includes(provider)? provider: null
        },
        addProviderEnabled() {
            return ADD_PROVIDER_ENABLED
        },
        editingProvider() {
            return this.$route.query.hasOwnProperty('editProvider')
        },
        // A modal for an edit, nothing for first-time setup. `div` rather than a
        // fragment so the @hide listener has somewhere to land.
        providerSetupWrapper() {
            return this.editingProvider? 'gl-modal': 'div'
        },
        providerSetupWrapperProps() {
            if(!this.editingProvider) return {}
            return {visible: true, modalId: 'providerSetupModal', size: 'lg', hideFooter: true, title: __('Edit provider')}
        },
        // What is already stored, so an edit opens showing it. The API-backed
        // getter, not the server-rendered ci_variables dataset.
        providerInitialValues() {
            return this.getVariables(this.environment) || {}
        },
        // Which setup panel, if any, this environment's primary provider belongs
        // to. gcp and aws keep their credentials there rather than in the
        // generic card, so that is where Edit has to go.
        primaryProviderSetupPanel() {
            const type = this.primaryProvider?._localTypeName
            if(!type) return null
            return PROVIDER_SETUP_PANELS.find(panel => lookupCloudProviderAlias(panel) == type) || null
        },
        gcpSignedIn() {
            return this.$route.query.hasOwnProperty('signed_in')
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
            // getPrimaryCard falls back to {}, which is truthy, so an environment with
            // no primary template reaches the else branch and prepends it -- rendering a
            // properties panel with no key, header or properties. Require a real card.
            if(!this.primaryProvider?.name || [lookupCloudProviderAlias('gcp'), lookupCloudProviderAlias('aws')].includes(this.primaryProvider._localTypeName)) {
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
            'ocFetchEnvironments',
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
        async loadProviderVariables() {
            if(this.variablesLoaded) return
            try {
                await this.ocFetchEnvironments({fullPath: this.getHomeProjectPath})
            } catch(e) {
                console.error('@loadProviderVariables', e)
            } finally {
                // Always, even on failure: this flag gates the panel, and a
                // refused fetch should leave an empty form rather than an Edit
                // button that silently does nothing.
                this.variablesLoaded = true
            }
        },

        editPrimaryProvider() {
            this.$router.push({
                ...this.$route,
                query: {...this.$route.query, provider: this.primaryProviderSetupPanel, editProvider: null}
            })
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
            // Close before the round-trip, not after: leaving the modal up while
            // the save and re-read complete reads as a hang, and it covers the
            // tabs underneath. The flag suppresses the watcher's refresh while
            // this runs -- see the note there.
            this.savingProvider = true
            this.showingProviderModal = false

            // Seed only: this method does its own re-read below, and the
            // refresh onSaveTemplate performs would race the router push that
            // clears ?provider. When that push lost, the page came back with
            // the query still set and the modal re-opened -- which read as a
            // modal that would not close.
            await this.seedBaseState()

            // Providers are written with patchEnv and read back through
            // fetchEnvironmentVariables, so refetching is enough -- the document
            // reload this replaced existed only to re-seed the ci_variables store
            // from its server-rendered dataset, which standalone never registers.
            await this.ocFetchEnvironments({fullPath: this.getHomeProjectPath})

            const redirect = sessionStorage['redirectOnProviderSaved']
            if(redirect) {
                // A caller sent the user here to make an environment: returning to
                // it is a real cross-page hand-off, not the self-reload.
                delete sessionStorage['redirectOnProviderSaved']
                this.savingProvider = false
                visitUrl(redirect)
                return
            }

            this.savingProvider = false
            await this.freshState()
        },
        // The base state the next save diffs against, rebuilt from what is
        // loaded. Sound only while that is authoritative -- freshState has just
        // fetched, or onSaveTemplate has just re-read.
        async seedBaseState() {
            const environment = this.environment
            this.setUpdateType('environment')
            this.setUpdateObjectProjectPath(this.getHomeProjectPath)
            this.setEnvironmentScope(environment.name)

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
        },
        // Runs after deployment-resources has committed. It re-reads rather
        // than reloading the document, and rather than reseeding from
        // `this.environment`: that is the snapshot freshState took, so anything
        // added since -- an external resource, most visibly -- was missing from
        // the base state the next save diffed against and was dropped on it.
        // That was the behaviour the old reload masked and the in-place branch
        // carried a TODO about.
        //
        // It takes no argument by design. triggerSave emits saveTemplate with
        // none, so a defaulted parameter here is read from whatever the
        // template binding happens to pass -- which is how the reload used to
        // fire on every save from that binding.
        async onSaveTemplate() {
            await this.ocFetchEnvironments({fullPath: this.getHomeProjectPath})
            await this.freshState()
        },
        async onProviderSetupSaved(provider) {
            // the blueprint overview page a redirect returns to preselects the
            // environment it was sent away to create
            sessionStorage['instantiate_env'] = this.environmentName
            sessionStorage['instantiate_provider'] = provider

            const redirect = sessionStorage['redirectOnProviderSaved']
            if(redirect) {
                delete sessionStorage['redirectOnProviderSaved']
                return visitUrl(redirect)
            }

            // The panel already wrote the credentials with patchEnv, so refetching
            // brings them back; staying put also keeps the query clear, which a
            // reload of this URL would not.
            await this.ocFetchEnvironments({fullPath: this.getHomeProjectPath})

            const query = {...this.$route.query}
            delete query.provider
            delete query.signed_in
            delete query.editProvider
            this.$router.replace({...this.$route, query})
            await this.freshState()
        },

        async onProviderSetupCancelled() {
            // The environment exists by now, so cancelling leaves it without
            // credentials rather than undoing anything -- the user deletes it from
            // the page they land on if that is what they meant.
            delete sessionStorage['redirectOnProviderSaved']

            const query = {...this.$route.query}
            delete query.provider
            delete query.signed_in
            delete query.editProvider
            this.$router.replace({...this.$route, query})
            await this.freshState()
        },

        async onDelete() {
            const environment = this.environment

            await deleteProvider(this.getHomeProjectPath, environment.name)

            this.setUpdateObjectProjectPath(this.getHomeProjectPath)
            this.setUpdateType('delete-environment')

            this.pushPreparedMutation(function(accumulator) {
                return [ {typename: 'DeploymentEnvironment', target: environment.name, patch: null} ]
            })

            await this.commitPreparedMutations()

            await deleteEnvironment(this.getHomeProjectPath, environment.name)

            sessionStorage['oc_flash'] = JSON.stringify({type: FLASH_TYPES.SUCCESS, message: `${environment.name} was deleted successfully.`})
            return visitUrl(this.$router.resolve({name: routes.OC_DASHBOARD_ENVIRONMENTS_INDEX}).href)
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

            // Cleared before the await, not just reassigned after it: until the
            // fetch resolves providerProps would otherwise still be spreading
            // the previous environment's record under this environment's name.
            this.providerRecord = null
            try {
                // Fetched for every environment, not only while a setup panel is
                // up: the Cloud Provider card's region, zone, project and role
                // all come from here now. Answers null in standalone and for a
                // user who may not read it.
                this.providerRecord = await fetchProvider(this.getHomeProjectPath, environmentName)
            } catch(e) {
                // Everything below still renders the environment. Letting a
                // provider endpoint that is merely down abort freshState would
                // leave the page blank.
                console.error('@freshState provider', e)
            }

            // An environment that already carries a provider row is set up; the
            // panel exists only for one that does not.
            this.providerRecorded = PROVIDER_SETUP_PANELS.includes(this.$route.query.provider) &&
                !!this.providerRecord

            // An edit renders the stored credentials, which live in the
            // environment's CI variables rather than in the export. Covers
            // arriving on the URL directly; the watcher covers the Edit button,
            // which changes only the query and so re-runs nothing here.
            if(this.editingProvider) await this.loadProviderVariables()

            await this.seedBaseState()

            const instances = _.cloneDeep(Object.values(environment.instances))
            const connections = _.cloneDeep(Object.values(environment.connections))

            // Saved instances can't resolve their types unless something fetched
            // them, and the only fetches here are the ones the Add buttons make.
            // Without this a reloaded environment renders no resource cards.
            //
            // Gated on connections too: the types this asks for come from
            // `providerTypesForEnvironment`, which reads connections, so an
            // environment whose provider is its only content -- every one that
            // isn't Kubernetes -- skipped the fetch and rendered a provider with
            // no inputs.
            if(instances.length || connections.length) {
                await this.environmentFetchTypesWithParams({
                    environmentName,
                    params: {implements: ['connect'], implementation_requirements: this.providerTypesForEnvironment(environment)},
                    options: {fallbackTypeRepository: {url: STD_REPOSITORY_URL}}
                })
            }

            await Promise.all(
                [
                    ...[...instances, ...connections].map(entry => this.normalizeUnfurlData({key: 'ResourceTemplate', entry, projectPath: this.getHomeProjectPath, root: this.getApplicationRoot})),
                    this.$route.query.hasOwnProperty('newProvider')? this.fetchProviders(): null
                ]
            )
            // Connections are normalized too: primary_provider is one, and without
            // this its type never resolves, so the provider card renders with no
            // inputs at all. The TODO below still stands for the save direction.
            // TODO implement and test normalization for connections - this should account better for users making manual changes

            await this.populateEnvironmentResources({
                resourceTemplates: [
                    ...instances,
                    ...connections
                ],
                environmentName,
                context: 'environment'
            })

            // Not while a setup panel is up: that panel is what writes the
            // provider, and this branch would open the generic modal over it.
            if(connections.length == 0 && !this.providerSetup) {
                const providers = (await fetchDashboardProviders(this.getHomeProjectPath))?.providersByEnvironment[environmentName] ?? []
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
                    await this.environmentFetchTypesWithParams({environmentName: this.environment.name, params: {extends: "tosca.relationships.ConnectsTo"}, options: {fallbackTypeRepository: {url: STD_REPOSITORY_URL}}})
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
                    await this.environmentFetchTypesWithParams({environmentName: this.environment.name, params: {implements: ['connect'], implementation_requirements: this.providerTypesForEnvironment(this.environment)}, options: {fallbackTypeRepository: {url: STD_REPOSITORY_URL}}})
                    this.setAvailableResourceTypes(this.environmentLookupDiscoverable(this.environment))
                    this.fetchedConnectable = true
                } catch(e) {
                    console.error(e)
                }
            }

            this.$refs.deploymentResources.promptAddExternalResource()
        },
        mapCloudProviderProps(source) {
            const result = mapProviderProps(source)

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
                        url: `${projectPathToHomeRoute(this.getHomeProjectPath)}/-/jobs/${jobId}`,
                    })
                }
            }

            return result
        }

    },
    watch: {
        // Routing between two /-/environments/:name routes reuses this component,
        // so created() does not fire again and the page would show the previous
        // environment's state. Reachable from the deploy dialog, which sits at the
        // dashboard root and so is present on an environment page.
        async '$route.params.name'() {
            await this.freshState()
        },
        async editingProvider(val) {
            if(val) await this.loadProviderVariables()
        },
        async showingProviderModal(val) {
            if(!val) {
                // Not while a save is in flight. freshState is not just a read:
                // on an environment whose connections look empty it calls
                // onProviderAdded, which scrollToProvider re-opens this modal
                // from. Closing before awaiting the save meant it ran against
                // the pre-save state, took that branch, and the modal appeared
                // never to close at all. onSaveProviderTemplate refreshes once
                // the write has landed instead.
                // Close first, and never behind an await: freshState can throw
                // (a type that will not resolve, an environment not in the store
                // yet), and with the close after it the modal simply stayed open
                // while the error surfaced only as "Unhandled error during
                // execution of watcher callback".
                this.$refs.providerModal?.close()
                if(this.savingProvider) return
                try {
                    await this.freshState()
                } catch(e) {
                    console.error('@showingProviderModal: refresh after close failed', e)
                }
            }
        }
    },

    async created() {
        await this.freshState()
    }
}
</script>
<template>
    <div class="environment" data-testid="dashboard-environment-page">
        <dashboard-breadcrumbs :items="breadcrumbItems" />
        <!-- First-time setup owns the page -- it is a step in creating the
             environment. Editing an existing provider is a modal, like every
             other provider's inputs. -->
        <!-- Not until the variables are in: the panels seed their fields from
             initialValues in data(), which runs once, so mounting early leaves
             an edit showing nothing that was already stored. -->
        <component
            :is="providerSetupWrapper"
            v-if="providerSetup && (!editingProvider || variablesLoaded)"
            v-bind="providerSetupWrapperProps"
            @hide="onProviderSetupCancelled"
        >
            <aws-provider-setup
                v-if="providerSetup == 'aws'"
                :environment-name="environmentName"
                :editing="editingProvider"
                :initial-values="providerInitialValues"
                @saved="onProviderSetupSaved"
                @cancel="onProviderSetupCancelled"
            />
            <gcp-provider-setup
                v-else
                :environment-name="environmentName"
                :signed-in="gcpSignedIn"
                :editing="editingProvider"
                :initial-values="providerInitialValues"
                @saved="onProviderSetupSaved"
                @cancel="onProviderSetupCancelled"
            />
        </component>
        <div v-else>
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
                    <div class="gl-flex gl-items-center" style="line-height: 20px;">
                        <detect-icon :size="20" :type="primaryProvider && primaryProvider._localTypeName" class="gl-mr-2"/> {{cloudProviderDisplayName}}
                    </div>
                </template>
                <template v-if="userCanEdit && primaryProviderSetupPanel" #header-controls>
                    <gl-button :data-testid="`edit-provider-${primaryProviderSetupPanel}`" @click.stop="editPrimaryProvider">
                        <div class="gl-flex">
                            <detect-icon name="pencil" :size="18" /> <span>Edit</span>
                        </div>
                    </gl-button>
                </template>
            </oc-properties-list>
            <oc-properties-list
                v-for="p in editableProviders"
                :key="p.name"
                :header="headerTitle(p)"
                :containerStyle="{'font-size': '0.9em', ...width}"
                :properties="p.properties"
                :schema="schema(p)"
                class="gl-mt-5"
            >
                <template #header-text>
                    <div class="gl-flex gl-items-center" style="line-height: 20px;">
                        <detect-icon :size="20" :type="p._localTypeName" class="gl-mr-2"/> {{headerTitle(p)}}
                    </div>
                </template>
                <template v-if="userCanEdit" #header-controls>
                    <gl-button :data-testid="`edit-provider-${p.name}`" @click.stop="scrollToProvider(p.name)">
                        <div class="gl-flex">
                            <detect-icon name="pencil" :size="18" /> <span>Edit</span>
                        </div>
                    </gl-button>
                </template>
            </oc-properties-list>
            <div v-if="userCanEdit && addProviderEnabled" class="gl-mt-5">
                <gl-button data-testid="add-provider" variant="confirm" @click="addProvider">
                    <div>
                        <gl-icon name="plus"/>
                        {{__('Add a Provider')}}
                    </div>
                </gl-button>
            </div>

            <gl-tabs v-model="currentTab" class="gl-mt-6">
                <oc-tab title="Resources">
                    <div class="gl-flex" v-if="!showDeploymentResources">
                        <div class="gl-mr-6">
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
                <oc-tab title="Variables" v-if="userCanEdit && !standalone">
                    <ci-variable-settings :environment-name="environmentName" />
                </oc-tab>
            </gl-tabs>
            <div v-if="(!showDeploymentResources) && userCanEdit" class="form-actions gl-flex gl-justify-end">
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
                    <div v-if="showingResourcesTab" class="gl-flex gl-items-center">
                        <h2 style="margin: 0 1.25em">
                            {{__('External Resources used by')}}
                            <span style="font-weight: 400">{{environment.name}}</span>
                            <!-- explicit gap: it used to come from the newline before
                                 this tag, which 19.3's icon rendering collapses away -->
                            <gl-icon v-if="showDeploymentResources" id="external-resources-help"
                               class="gl-ml-2"
                               data-testid="external-resources-help" name="information-o" :size="16"/>
                        </h2>
                        <!-- two paragraphs, so a tooltip won't do -->
                        <gl-popover v-if="showDeploymentResources" target="external-resources-help" triggers="hover focus">
                            <p>
                                External resources are third-party resources that already exist elsewhere that Unfurl Cloud connects to (i.e. a pre-existing DNS server, compute instance etc). Unfurl.cloud cannot delete or control the lifecycle of an external resource.
                            </p>
                            <p class="gl-mb-0">
                                External resources are a convenient way to reuse configurations across many deployments.
                            </p>
                        </gl-popover>
                    </div>
                    <div v-else-if="showingPublicCloudTab" class="gl-flex gl-items-center">
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

                <deployment-resources :class="{'gl-mt-3': isNewProvider}" @saveTemplate="onSaveProviderTemplate" @deleteResource="onDelete" :save-status="saveStatus" :filter="isProvider" :delete-status="deleteStatus"  ref="providerResources" external-status-indicator display-validation />


            </gl-modal>
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
.external-resource-controls :deep(button) {
    padding: 0.4em;
    margin: 0 0.25em;
}
.confirm-container {
    margin-left: auto;
}
.confirm-container :deep(button) {
    padding: 0.5em;
}

.environment :deep(td.name-column) {
    width: 11em;
}

.environment :deep(td.value-column) {
    width: calc(max(500px, 50%) - 11em);
}

</style>
