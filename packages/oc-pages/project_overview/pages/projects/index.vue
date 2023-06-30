<script>
import createFlash, { FLASH_TYPES } from '~/flash';
import { GlIcon, GlCard, GlTabs, GlModal, GlModalDirective, GlDropdown, GlFormGroup, GlFormInput, GlDropdownItem, GlDropdownDivider, GlMarkdown } from '@gitlab/ui';
import TableWithoutHeader from 'oc_vue_shared/components/oc/table_without_header.vue';
import { mapGetters, mapActions, mapMutations } from 'vuex';
import _ from 'lodash'
import { s__, __ } from '~/locale';
import HeaderProjectView from '../../components/header.vue';
import ProjectDescriptionBox from '../../components/project_description.vue';
import EnvironmentCreationDialog from '../../components/environment-creation-dialog.vue'
import YourDeployments from '../../components/your-deployments.vue'
import OpenCloudDeployments from '../../components/open-cloud-deployments.vue'
import NotesWrapper from 'oc_vue_shared/components/notes-wrapper.vue'
import {OcTab, DetectIcon, EnvironmentSelection} from 'oc_vue_shared/components/oc'
import { bus } from 'oc_vue_shared/bus';
import { slugify, lookupCloudProviderAlias, USER_HOME_PROJECT } from 'oc_vue_shared/util.mjs'
import {deleteEnvironmentByName} from 'oc_vue_shared/client_utils/environments'
import {fetchProjectPermissions} from 'oc_vue_shared/client_utils/projects'
import {lookupCloudProviderShortName} from 'oc_vue_shared/util.mjs'
import { createDeploymentTemplate } from '../../store/modules/deployment_template_updates.js'
import * as routes from '../../router/constants'

export default {
    name: 'ProjectPageHome',
    i18n: {
        buttonLabel: __('Create new template'),
    },
    components: {
        OcTab,
        EnvironmentSelection,
        GlModal,
        GlCard, GlIcon, GlTabs,
        GlFormGroup,
        GlFormInput,
        HeaderProjectView,
        TableWithoutHeader,
        EnvironmentCreationDialog,
        ProjectDescriptionBox,
        YourDeployments,
        OpenCloudDeployments,
        GlMarkdown,
        NotesWrapper
    },
    directives: {
        GlModal: GlModalDirective,
    },
    data() {

        return {
            triedPopulatingDeploymentItems: false,
            instantiateAs: null,
            projectSlugName: null,
            templateForkedName: null,
            templateSelected: {},
            selectedEnvironment: null,
            newEnvironmentProvider: null,
            hasEditPermissions: false,
            creatingEnvironment: false,
            createEnvironmentName: '',
            createEnvironmentProvider: '',
            modalNextStatus: true,
            showBannerIntro: true,
            submitting: false,
            bannerInfo: {
                title: __(`Deploy ${this.$projectGlobal.projectName}`),
                description: ""
            },
            currentTab: 0
        }
    },
    computed: {
        shouldDisableSubmitTemplate() {
            if(this.creatingEnvironment) {
                return !(this.createEnvironmentProvider && this.createEnvironmentName)
            }
            if(this.deployDialogError) return true
            if(!this.templateForkedName) return true
            if(this.instantiateAs != 'template' && !this.selectedEnvironment) return true

            return false
        },
        modalTitle() {
            if(this.creatingEnvironment) {
                return s__('OcDeployments|Create New Environment')
            }
            if(this.instantiateAs == 'template') {
                return s__('OcDeployments|Create New Deployment Template')
            }

            return s__('OcDeployments|Create New Deployment')

        },
        deployDialogError() {
            if(this.instantiateAs == 'deployment-draft') {
                const environment = this.selectedEnvironment ?? null
                if(environment && this.lookupDeploymentOrDraft(slugify(this.templateForkedName), environment)) {
                    return `'${this.templateForkedName.trim()}' already exists in environment '${environment?.name || environment}'`
                }
            }
            return null
        },
        ...mapGetters([
            'yourDeployments',
            'getApplicationBlueprint',
            'openCloudDeployments',
            'getProjectDescription',
            'getTemplatesList',
            'getUsername',
            'getNextDefaultDeploymentName',
            'getMatchingEnvironments',
            'getDefaultEnvironmentName',
            'lookupDeploymentOrDraft',
            'lookupEnvironment',
            'getHomeProjectPath',
            'getLastUsedEnvironment',
            'environmentsAreReady',
            'commentsCount',
            'commentsIssueUrl',
            'hasCriticalErrors'
        ]),
        primaryProps() {
            return {
                text: __('Next'),
                attributes: [{ category: 'primary' }, { variant: 'confirm' }, { disabled:  this.shouldDisableSubmitTemplate}],
            };
        },
        cancelProps() {
            return {
                text: this.creatingEnvironment? __('Back'): __('Cancel')
            };
        },
        querySpec() {
            if(this.instantiateAs == 'deployment-draft' && this.templateSelected?.name)
                return {
                    fn: this.templateForkedName || undefined,
                    ts: this.projectSlugName || undefined,
                    tn: this.templateSelected.name || undefined // used to control modal for #oc-569

                }
            else return {}
        },
        matchingEnvironments() {
            return this.getMatchingEnvironments(this.templateSelected?.cloud)
        },
        // NOTE I probably should have just used a watcher here
        defaultEnvironmentName() {
            return (
                this.getLastUsedEnvironment({ cloud: this.templateSelected?.cloud }) || this.selectedEnvironment || this.getDefaultEnvironmentName(this.templateSelected?.cloud)
            )
        },

        activeTab() {
            const {availableBlueprintsTab, openCloudDeploymentsTab, yourDeploymentsTab, commentsTab} = this.$refs
            if(availableBlueprintsTab?.active) return 'availableBlueprintsTab'
            if(openCloudDeploymentsTab?.active) return 'openCloudDeploymentsTab'
            if(yourDeploymentsTab?.active) return 'yourDeploymentsTab'
            if(commentsTab?.active) return 'commentsTab'
            return null
        },

    },
    watch: {
        querySpec: function(query, oldQuery) {
            if(_.isEqual(query, oldQuery)) return


            const path = this.$route.path
            if(document.activeElement.tagName == 'INPUT') {
                const el = document.activeElement
                el.onblur = _ => {
                    this.$router.replace({path, query})
                    el.onblur = null
                }
            } else {
                this.$router.replace({path, query})
            }

        },
        templateSelected: function(val) {
            if(this.templateForkedName) return
            if(val && this.instantiateAs == 'deployment-draft') this.templateForkedName = this.getNextDefaultDeploymentName(this.getApplicationBlueprint.title + ' ' + lookupCloudProviderShortName(val.cloud))
            else this.templateForkedName = ''

        },
        environmentsAreReady(newState, _oldState) {
            if (newState && this.yourDeployments.length) {
                this.populateDeploymentItems(this.yourDeployments)
            }
        },
        defaultEnvironmentName: {
            immediate: true,
            handler(val) {
                if(!this.selectedEnvironment) this.selectedEnvironment = this.lookupEnvironment(val)
            }
        }
    },

    created() {
        bus.$on('deployTemplate', (template) => {
            this.instantiateAs = 'deployment-draft'
            this.templateSelected = {...template};
            this.projectSlugName = template.name;
        });

        bus.$on('editTemplate', (template) => {
            this.templateSelected = {...template};
            this.redirectToTemplateEditor();
        });
    },
    beforeDestroy() {
        // breaks without iife ;)
        // also works with setTimeout and console.log
        (function() {
            bus.$off('deployTemplate')
            bus.$off('editTemplate')
        })()
    },
    beforeMount () {
        if(this.$route.hash) {
            this.currentTab = 1
        }
    },
    async mounted() {
        const projectPath = this.$projectGlobal.projectPath

        // async, not awaiting
        fetchProjectPermissions(projectPath).then(hasEditPermissions => this.hasEditPermissions = hasEditPermissions)
        this.fetchCommentsIssue()
        this.populateJobsList()
        //

        await this.loadPrimaryDeploymentBlueprint()
        if(this.hasCriticalErrors) return
        this.fetchCloudmap() // async, not awaiting

        if (this.environmentsAreReady && this.yourDeployments.length && !this.triedPopulatingDeploymentItems) {
            this.triedPopulatingDeploymentItems = true
            this.populateDeploymentItems(this.yourDeployments)
        }
        this.selectedEnvironment = this.lookupEnvironment(this.$route.query?.env || sessionStorage['instantiate_env'])
        this.newEnvironmentProvider = this.$route.query?.provider || sessionStorage['instantiate_provider']

        const templateSelected = this.$route.query?.ts?
            this.getTemplatesList.find(template => template.name == this.$route.query.ts) : null

        if(templateSelected) {
            bus.$emit('deployTemplate', templateSelected)
            this.templateForkedName = this.$route.query?.fn
        }
    },
    methods: {
        redirectToTemplateEditor(page=routes.OC_PROJECT_VIEW_CREATE_TEMPLATE) {
            const query = this.$route.query || {}
            if(Object.keys(query).length != 0) this.$router.replace({query: {}})
            const dashboard = encodeURIComponent(this.selectedEnvironment?._dashboard || this.getHomeProjectPath)
            // TODO re-enable this when we're able to update the current namespace
            // https://github.com/onecommons/gitlab-oc/issues/867
            // this.$router.push({ query, name: page, params: { dashboard, environment: this.templateSelected.environment, slug: this.templateSelected.name}});
            window.location.href = this.$router.resolve({ query, name: page, params: { dashboard, environment: this.templateSelected.environment, slug: this.templateSelected.name}}).href
        },

        clearModalTemplate(e) {
            if(this.submitting) return
            this.templateForkedName = null;
            this.templateSelected = null
            this.selectedEnvironment = null
            this.creatingEnvironment = false
        },

        instantiatePrimaryDeploymentTemplate() {
            this.instantiateAs = 'template'
            this.templateSelected = {...this.getTemplatesList[0]};
            this.projectSlugName = '';
        },

        async onSubmitModal(e) {
            // not implemented
            if(this.creatingEnvironment) {
                e.preventDefault()
                this.redirectToNewEnvironment()
                return
            }
            if (this.projectSlugName !== null) {
                this.submitting = true
                this.prepareTemplateNew();

                if(this.instantiateAs == 'deployment-draft'){
                    // store the environment in local storage
                    const lastUsedEnvironment = {
                        cloud: this.templateSelected.cloud,
                        environmentName: this.templateSelected.environment
                    }
                    this.updateLastUsedEnvironment({
                        lastUsedEnvironment,
                        username: this.getUsername
                    })

                    this.redirectToTemplateEditor(routes.OC_PROJECT_VIEW_DRAFT_DEPLOYMENT);
                } else {
                    const args = {...this.templateSelected, blueprintName: this.getApplicationBlueprint.name}
                    this.pushPreparedMutation(createDeploymentTemplate(args))

                    await this.commitPreparedMutations()
                    this.redirectToTemplateEditor();
                }

                this.submitting = false
                this.clearModalTemplate()
            }

        },
        async loadPrimaryDeploymentBlueprint() {
            const projectPath = this.$projectGlobal.projectPath
            if(!projectPath) throw new Error('projectGlobal.projectPath is not defined')
            await this.fetchProject({projectPath});
            if(this.hasCriticalErrors) return
            const templateSlug = this.getApplicationBlueprint?.primaryDeploymentBlueprint
            if(!templateSlug) return
            return await this.populateTemplateResources({
                projectPath,
                templateSlug,
            })
        },
        onCancelModal(e) {
            if(this.creatingEnvironment) {
                this.creatingEnvironment = false
                this.createEnvironmentName = ''
                this.createEnvironmentProvider = ''
                e.preventDefault()
            }
        },
        prepareTemplateNew() {
            this.templateSelected.primary = this.templateSelected.title
            this.templateSelected.title = this.templateForkedName;
            this.templateSelected.name = slugify(this.templateForkedName);
            this.templateSelected.totalDeployments = 0;
            this.templateSelected.environment = this.selectedEnvironment?.name || this.defaultEnvironmentName
            this.templateSelected.primaryType = this.getApplicationBlueprint.primary
        },

        createNewEnvironment() {
            this.creatingEnvironment = true
        },

        redirectToNewEnvironment() {
            this.$refs.environmentDialog.beginEnvironmentCreation()
            /*
            const redirectTarget = `${window.location.pathname}${window.location.search}`
            const pathComponents = window.location.pathname.split("/").slice(0, -2)
            pathComponents[1] = this.getUsername
            pathComponents[2] = USER_HOME_PROJECT
            const url = `${window.origin}${pathComponents.join("/")}/environments/new_redirect?new_env_redirect_url=${encodeURIComponent(redirectTarget)}`;
            window.location = url;
            */
        },

        handleClose() {
            this.showBannerIntro = false;
        },

        ...mapActions([
            'commitPreparedMutations',
            'populateDeploymentItems',
            'populateJobsList',
            'populateTemplateResources',
            'fetchProject',
            'updateLastUsedEnvironment',
            'fetchCloudmap',
            'fetchCommentsIssue'
        ]),
        ...mapMutations([
            'pushPreparedMutation',
        ])
    }
}
</script>
<template>
    <div>

        <!-- Header of project view -->
        <HeaderProjectView :project-info="getApplicationBlueprint" />

        <div v-if="getApplicationBlueprint && getApplicationBlueprint.name">
            <!-- Project Description -->
            <ProjectDescriptionBox
                    :project-info="getApplicationBlueprint"
                    />

            <gl-tabs v-model="currentTab">
                <oc-tab ref="availableBlueprintsTab" title="Available Blueprints">
                    <div class="">
                        <gl-card>
                            <template #header>
                                <div class="d-flex align-items-center">
                                    <gl-icon name="archive" class="mr-2"/>
                                    <h5 class="mb-0 mt-0">
                                        {{__('Available Deployment Blueprints')}}
                                    </h5>
                                </div>
                            </template>
                            <TableWithoutHeader :data-rows="getTemplatesList" :editable="hasEditPermissions" />
                        </gl-card>
                    </div>
                </oc-tab>
                <oc-tab v-if="environmentsAreReady && yourDeployments.length > 0" ref="yourDeploymentsTab" title="Your Deployments">
                    <div class="">
                        <your-deployments />
                    </div>

                </oc-tab>
                <oc-tab v-if="openCloudDeployments.length > 0" ref="openCloudDeploymentsTab" title="Open Cloud Deployments">
                    <open-cloud-deployments />
                </oc-tab>
                <oc-tab v-if="commentsIssueUrl" ref="commentsTab" title="Comments" :title-count="commentsCount">
                    <gl-card>
                        <template #header>
                            <div class="d-flex align-items-center">
                                <gl-icon name="comments" class="mr-2"/>
                                <h5 class="mb-0 mt-0">
                                    {{__('General Comments')}}
                                </h5>
                            </div>
                        </template>

                        <notes-wrapper :poll="activeTab == 'commentsTab'"/>
                    </gl-card>
                </oc-tab>

            </gl-tabs>

            <gl-card v-if="$projectGlobal.readme">
                <template #header>
                    <div class="d-flex align-items-center">
                        <gl-icon name="information-o" class="mr-2"/>
                        <h5 class="mb-0 mt-0">
                            {{__('README.md')}}
                        </h5>
                    </div>
                </template>
                <gl-markdown class="md" v-html="$projectGlobal.readme" />
            </gl-card>


            <!-- Modal -->
            <gl-modal
                ref="oc-templates-deploy"
                modal-id="oc-templates-deploy"
                :visible="!!$route.query.tn"

                :title="modalTitle"
                :action-primary="primaryProps"
                :action-cancel="cancelProps"
                no-fade
                @primary="onSubmitModal"
                @cancel="onCancelModal"
                @hidden="clearModalTemplate"
            >
                <environment-creation-dialog
                    v-if="creatingEnvironment"
                    ref="environmentDialog"
                    @environmentNameChange="env => createEnvironmentName = env"
                    @cloudProviderChange="provider => createEnvironmentProvider = provider"
                    :cloud-provider="templateSelected && templateSelected.cloud"
                    />
                <div v-else>
                    <gl-form-group
                        label="Name"
                        class="col-md-4 align_left"
                    >
                        <gl-form-input
                        id="input1"
                        data-testid="deployment-name-input"
                        v-model="templateForkedName"
                        name="input['template-name']"
                        type="text"
                        />

                    </gl-form-group>
                    <div class="col-md-6" v-if="instantiateAs!='template'">
                        <p>{{ __("Select an environment to deploy this template to:") }}</p>
                        <environment-selection
                            v-model="selectedEnvironment"
                            :provider="templateSelected && templateSelected.cloud"
                            :error="deployDialogError"
                            @createNewEnvironment="createNewEnvironment"
                            environment-creation
                        />
                    </div>
                </div>
            </gl-modal>
        </div>
    </div>
</template>
<style scoped>
h2.oc-title-section {
    font-weight: bold;
    font-size: 19px;
    line-height: 24px;
}

.dropdown-parent >>> ul { width: unset; }
</style>
