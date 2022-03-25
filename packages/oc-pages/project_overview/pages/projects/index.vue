<script>
import createFlash, { FLASH_TYPES } from '~/flash';
import { GlIcon, GlCard, GlTabs, GlModal, GlModalDirective, GlDropdown, GlFormGroup, GlFormInput, GlDropdownItem, GlDropdownDivider } from '@gitlab/ui';
import TableWithoutHeader from '../../../vue_shared/components/oc/table_without_header.vue';
import ErrorSmall from '../../../vue_shared/components/oc/ErrorSmall.vue'
import { mapGetters, mapActions, mapMutations } from 'vuex';
import _ from 'lodash'
import { s__, __ } from '~/locale';
import HeaderProjectView from '../../components/header.vue';
import ProjectDescriptionBox from '../../components/project_description.vue';
import EnvironmentCreationDialog from '../../components/environment-creation-dialog.vue'
import DeployedBlueprints from '../../components/deployed-blueprints.vue'
import YourDeployments from '../../components/your-deployments.vue'
import {OcTab, DetectIcon} from '../../../vue_shared/oc-components'
import { bus } from '../../bus';
import { slugify, lookupCloudProviderAlias, USER_HOME_PROJECT } from '../../../vue_shared/util.mjs'
import {deleteEnvironmentByName} from '../../../vue_shared/client_utils/environments'
import { createDeploymentTemplate } from '../../store/modules/deployment_template_updates.js'

export default {
    name: 'ProjectPageHome',
    i18n: {
        buttonLabel: __('Create new template'),
    },
    components: {
        OcTab,
        GlModal,
        GlCard, GlIcon, GlTabs,
        GlFormGroup,
        GlFormInput,
        HeaderProjectView,
        TableWithoutHeader,
        EnvironmentCreationDialog,
        GlDropdown,
        GlDropdownItem,
        GlDropdownDivider,
        ProjectDescriptionBox,
        ErrorSmall,
        DetectIcon,
        DeployedBlueprints,
        YourDeployments
    },
    directives: {
        GlModal: GlModalDirective,
    },
    data() {

        return {
            instantiateAs: null,
            projectSlugName: null,
            templateForkedName: null,
            templateSelected: {},
            selectedEnvironment: null,
            newEnvironmentProvider: null,
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
            if(this.instantiateAs != 'template' && this.defaultEnvironmentName == __("Select")) return true

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
                const environment = this.defaultEnvironmentName == __("Select")? null : this.defaultEnvironmentName
                if(environment && this.lookupDeployment(this.templateForkedName, environment)) {
                    return `'${this.templateForkedName}' already exists in environment '${environment}'`
                }
            }
            return null
        },
        ...mapGetters([
            'yourDeployments',
            'getEnvironments',
            'getProjectInfo',
            'getTemplatesList',
            'hasEditPermissions',
            'getUsername',
            'getNextDefaultDeploymentName',
            'getMatchingEnvironments',
            'getDefaultEnvironmentName',
            'lookupDeployment',
            'lookupEnvironment',
            'getHomeProjectPath'
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
                    ts: this.projectSlugName || undefined

                }
            else return {}
        },
        matchingEnvironments() {
            return this.getMatchingEnvironments(this.templateSelected?.cloud)
        },
        // NOTE I probably should have just used a watcher here
        defaultEnvironmentName() {
            return (
                this.selectedEnvironment || this.getDefaultEnvironmentName(this.templateSelected?.cloud) || __("Select")
            )
        },
        inputProperties() {
            try {
                return Object.values(this.getProjectInfo.primary.inputsSchema.properties || {})
            } catch(e) {
                return []
            }
        },
        outputProperties() {
            try {
                return Object.values(this.getProjectInfo.primary.outputsSchema.properties || {})
            } catch(e) {
                return []
            }

        }
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
            if(val && this.instantiateAs == 'deployment-draft') this.templateForkedName = this.getNextDefaultDeploymentName(val.title)
            else this.templateForkedName = ''

        }
    },

    created() {
        this.syncGlobalVars(this.$projectGlobal);
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

        await this.fetchProjectInfo({projectPath: this.$projectGlobal.projectPath})
        this.selectedEnvironment = this.$route.query?.env || sessionStorage['instantiate_env']
        this.newEnvironmentProvider = this.$route.query?.provider || sessionStorage['instantiate_provider']
        const expectsCloudProvider = sessionStorage['expect_cloud_provider_for']

        delete sessionStorage['instantiate_env']
        delete sessionStorage['instantiate_provider']

        if(expectsCloudProvider && !(this.selectedEnvironment && this.newEnvironmentProvider)) {
            // TODO find a way to merge this implementation with dashboard

            createFlash({
                message: `Creation of environment "${expectsCloudProvider}" cancelled.`,
                type: FLASH_TYPES.WARNING
            })

            await deleteEnvironmentByName(this.getHomeProjectPath, expectsCloudProvider)
            this.discardEnvironment(expectsCloudProvider)
        }

        delete sessionStorage['expect_cloud_provider_for']

        // add environment to environments.json
        // TODO break this off into a function
        const envName = this.selectedEnvironment
        if(envName && this.newEnvironmentProvider) {
            const primary_provider = {name: 'primary_provider', type: lookupCloudProviderAlias(this.newEnvironmentProvider), __typename: 'ResourceTemplate'}

            await this.updateEnvironment({
                envName: this.selectedEnvironment,
                patch: {primary_provider, connections: {primary_provider}}
            })
        }
        //

        const templateSelected = this.$route.query?.ts?
            this.$store.getters.getTemplatesList.find(template => template.name == this.$route.query.ts) : null 
        
        if(templateSelected) {
            bus.$emit('deployTemplate', templateSelected)
            this.$refs['oc-templates-deploy'].show()

            this.templateForkedName = this.$route.query?.fn
        }
    },
    methods: {
        redirectToTemplateEditor(page='templatePage') {
            const query = this.$route.query || {}
            if(Object.keys(query).length != 0) this.$router.replace({query: {}})
            this.$router.push({ query, name: page, params: { environment: this.templateSelected.environment, slug: this.templateSelected.name}});
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

                if(this.instantiateAs == 'deployment-draft') {
                    // NOTE doesn't use this.prepareTemplateNew atm
                    /*
                    //<envname>/<blueprintname>/<deploymentname>/deployment-blueprint.json
                    this.setUpdateObjectPath(
                        `${this.templateSelected.environment}/${this.getProjectInfo.name}/${this.templateForkedName}/deployment-blueprint.json`
                    )
                    this.setUpdateObjectProjectPath(`${this.getUsername}/${USER_HOME_PROJECT}`)
                    */
                } else {

                    const args = {...this.templateSelected, blueprintName: this.getProjectInfo.name}
                    this.pushPreparedMutation(createDeploymentTemplate(args))
                }

                if(this.instantiateAs == 'deployment-draft'){
                    this.redirectToTemplateEditor('deploymentDraftPage');
                } else {
                    await this.commitPreparedMutations()
                    this.redirectToTemplateEditor();
                }
                this.submitting = false
                this.clearModalTemplate()
            }

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
            this.templateSelected.environment = this.selectedEnvironment || this.defaultEnvironmentName
            this.templateSelected.primaryType = this.getProjectInfo.primary
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
            'syncGlobalVars',
            'fetchProjectInfo',
            'commitPreparedMutations',
            'updateEnvironment'
        ]),
        ...mapMutations([
            'pushPreparedMutation',
            'setUpdateObjectPath',
            'setUpdateObjectProjectPath',
            'discardEnvironment'
        ])
    }
}
</script>
<template>
    <div>

        <!-- Header of project view -->
        <HeaderProjectView :project-info="getProjectInfo" />

        <div v-if="getProjectInfo.name">
            <!-- Project Description -->
            <ProjectDescriptionBox 
                    :project-info="getProjectInfo"
                    :requirements="getProjectInfo.primary.requirements" 
                    :inputs="inputProperties"
                    :outputs="outputProperties"
                    :project-description="getProjectInfo.description"
                    :project-image="getProjectInfo.image"
                    :live-url="getProjectInfo.livePreview"
                    :project-name="getProjectInfo.name"
                    :project-title="getProjectInfo.title"
                    :code-source-url="getProjectInfo.sourceCodeUrl"
                    />

            <!-- Table -->
            <!-- TODO this will probably get removed -->
            <deployed-blueprints v-if="false"/>

            <gl-tabs v-model="currentTab">
                <oc-tab title="Available Blueprints">
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
                <oc-tab v-if="yourDeployments.length > 0" title="Your Deployments">
                    <div class="">
                        <your-deployments />
                    </div>

                </oc-tab>

            </gl-tabs>



            <!-- Modal -->
            <gl-modal
                ref="oc-templates-deploy"
                modal-id="oc-templates-deploy"
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
                    />
                <div v-else>
                    <gl-form-group
                        label="Name"
                        class="col-md-4 align_left"
                    >
                        <gl-form-input
                        id="input1"
                        v-model="templateForkedName"
                        name="input['template-name']"
                        type="text"
                        />

                    </gl-form-group>
                    <div class="col-md-6 dropdown-parent" v-if="instantiateAs!='template'">
                        <p>{{ __("Select an environment to deploy this template to:") }}</p>
                        <!-- selectedEnvironment ends up populating defaultEnvironmentName -->
                        <gl-dropdown ref="dropdown">
                            <template #button-text>
                                <span><detect-icon class="mr-2" no-default :env="defaultEnvironmentName != __('Select') && defaultEnvironmentName"/>{{defaultEnvironmentName}}</span>
                            </template>

                            <div v-if="getEnvironments.length > 0">
                                <gl-dropdown-item v-for="env in matchingEnvironments" @click="() => selectedEnvironment = env.name" :key="env.name">
                                    <div><detect-icon class="mr-2" :env="env" />{{ env.name }}</div>
                                </gl-dropdown-item>
                                <gl-dropdown-divider />
                            </div>
                            <gl-dropdown-item class="disabled" @click="createNewEnvironment"><div style="white-space: pre">{{ __("Create new environment") }}</div></gl-dropdown-item>
                        </gl-dropdown>
                        <error-small :message="deployDialogError"/>
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
