<script>
import { GlIcon, GlModal, GlBanner, GlButton, GlModalDirective, GlDropdown, GlFormGroup, GlFormInput, GlDropdownItem, GlDropdownDivider } from '@gitlab/ui';
//import TableWithoutHeader from '../../../vue_shared/components/oc/table_without_header.vue';
import ErrorSmall from '../../../vue_shared/components/oc/ErrorSmall.vue'
import { mapGetters, mapActions, mapMutations } from 'vuex';
import _ from 'lodash'
import { s__, __ } from '~/locale';
import HeaderProjectView from '../../components/header.vue';
import ProjectDescriptionBox from '../../components/project_description.vue';
import EnvironmentCreationDialog from '../../components/environment-creation-dialog.vue'
import DeployedBlueprints from '../../components/deployed-blueprints.vue'
import { bus } from '../../bus';
import { slugify, lookupCloudProviderAlias, USER_HOME_PROJECT } from '../../../vue_shared/util.mjs'
import { createDeploymentTemplate } from '../../store/modules/deployment_template_updates.js'
import {DetectIcon} from '../../../vue_shared/oc-components'

export default {
    name: 'ProjectPageHome',
    components: {
        GlIcon,
        GlModal,
        GlButton,
        GlFormGroup,
        GlFormInput,
        HeaderProjectView,
 //       TableWithoutHeader,
        EnvironmentCreationDialog,
        GlDropdown,
        GlDropdownItem,
        GlDropdownDivider,
        ProjectDescriptionBox,
        GlBanner,
        ErrorSmall,
        DetectIcon,
        DeployedBlueprints
    },
    directives: {
        GlModal: GlModalDirective,
    },
    data() {
        return {
            instantiateAs: 'deployment-draft',
            //projectSlugName: null,
            templateForkedName: null,
            templateSelected: {},
            selectedEnvironment: null,
            newEnvironmentProvider: null,
            createEnvironmentName: '',
            createEnvironmentProvider: '',
            modalNextStatus: true,
            modalHistory: 0,
            showBannerIntro: true,
            submitting: false,
            bannerInfo: {
                title: __(`Deploy ${this.$projectGlobal.projectName}`),
                description: ""
            }
        }
    },
    computed: {
        creatingEnvironment: {
            get() {
                return this.$route.query?.modal == 'create-env'
            },
            set() {
                const query = this.$route.query
                const target = {...this.$route, query: {...query, modal: 'create-env'}}
                this.modalHistory += 1
                this.$router.push(target)
            }
        },
        selectingEnvironment: {
            get() {
                return this.$route.query?.modal == 'env-select'
            },
            set() {
                const query = this.$route.query
                const target = {...this.$route, query: {...query, modal: 'env-select'}}
                this.modalHistory += 1
                this.$router.push(target)
            }
        },
        selectingBlueprint: {
            get() {
                return this.$route.query?.modal == 'blueprint-select'
            },
            set() {
                const query = this.$route.query
                const target = {...this.$route, query: {...query, modal: 'blueprint-select'}}
                this.modalHistory += 1
                this.$router.push(target)
            }
        },
        isBackButton() {
            return !this.selectingEnvironment && this.modalHistory > 0
        },
        shouldDisableSubmitTemplate() {
            if(this.creatingEnvironment) {
                return !(this.createEnvironmentProvider && this.createEnvironmentName)
            }
            if(this.selectingEnvironment) {
                return !this.selectedEnvironment
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

            return s__('OcDeployments|Select a Deployment Blueprint')

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
            'getEnvironments',
            'getProjectInfo',
            'getTemplatesList',
            'hasEditPermissions',
            'getUsername',
            'getNextDefaultDeploymentName',
            'getMatchingEnvironments',
            'getDefaultEnvironmentName',
            'lookupDeployment',
            'lookupEnvironment'
        ]),
        primaryProps() {
            return {
                text: __('Next'),
                attributes: [{ category: 'primary' }, { variant: 'info' }, { disabled:  this.shouldDisableSubmitTemplate}],
            };
        },
        cancelProps() {
            return {
                text: this.isBackButton? __('Back'): __('Cancel')
            };
        },
        querySpec() {
            if(this.instantiateAs == 'deployment-draft' && this.templateSelected?.name)
                return {
                    fn: this.templateForkedName || undefined,
                    ts: this.templateSelected?.name || undefined

                }
            else return {}
        },
        matchingEnvironments() {
            return this.getMatchingEnvironments(this.templateSelected?.cloud)
        },
        // NOTE I probably should have just used a watcher here
        defaultEnvironmentName() {
            return (
                this.selectedEnvironment?.name || this.getDefaultEnvironmentName(this.templateSelected?.cloud) || __("Select")
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

        },
        blueprintsByEnvironment() {
            if(! this.selectedEnvironment?.primary_provider?.type) return this.getTemplatesList
            return this.getTemplatesList.filter(blueprint => {
                return (!blueprint.cloud  || lookupCloudProviderAlias(blueprint.cloud) == this.selectedEnvironment.primary_provider.type)
            })
        }

    },
    watch: {
        querySpec: function(_query, oldQuery) {
            if(_.isEqual(_query, oldQuery)) return
            const query = {...this.$route.query, ..._query}
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
        },
        selectingEnvironment(val) {
            if(val) {
                this.templateSelected = null
            }
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

    async mounted() {

        await this.fetchProjectInfo({projectPath: this.$projectGlobal.projectPath})
        const envName = this.$route.query?.env
        this.newEnvironmentProvider = this.$route.query?.provider

        // add environment to environments.json
        // TODO break this off into a function
        if(envName && this.newEnvironmentProvider) {
            const primary_provider = {type: lookupCloudProviderAlias(this.newEnvironmentProvider), __typename: 'ResourceTemplate'}

            await this.updateEnvironment({
                envName,
                patch: {primary_provider, connections: {primary_provider}}
            })
        }
        //

        const templateSelected = this.$route.query?.ts?
            this.$store.getters.getTemplatesList.find(template => template.name == this.$route.query.ts) : null 
        
        this.selectedEnvironment = this.lookupEnvironment(envName)
        if(this.$route.query.modal) {
            this.$refs['oc-templates-deploy'].show()
        }
        /*
        if(templateSelected) {
            bus.$emit('deployTemplate', templateSelected)
            this.$refs['oc-templates-deploy'].show()

            this.templateForkedName = this.$route.query?.fn
        }
        */
    },
    methods: {
        redirectToTemplateEditor(page='templatePage') {
            const query = this.$route.query || {}
            if(Object.keys(query).length != 0) this.$router.replace({query: {}})
            const push = { query, name: page, params: { environment: this.selectedEnvironment.name, slug: this.templateSelected.name}}
            console.log(push)
            this.$router.push(push);
        },

        clearModalTemplate(e) {
            if(this.submitting) return
            this.modalHistory = 0
            const query = {...this.$route.query}
            delete query.modal
            this.$router.push({...this.$route, query})
            this.templateForkedName = null;
            this.templateSelected = null
            this.selectedEnvironment = null
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
            if(this.selectingEnvironment) {
                e.preventDefault()
                this.selectingBlueprint = true
            }
            if (this.templateSelected !== null) {
                this.submitting = true
                //this.prepareTemplateNew();

                console.log(this.instantiateAs)
                if(this.instantiateAs == 'deployment-draft') {
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
            if(this.isBackButton) {
                e.preventDefault()
                window.history.back()
            }
        },
        /* 
        * will likely remove this
        prepareTemplateNew() {
            this.templateSelected.primary = this.templateSelected.title
            this.templateSelected.title = this.templateForkedName;
            this.templateSelected.name = slugify(this.templateForkedName);
            this.templateSelected.totalDeployments = 0;
            this.templateSelected.environment = this.$refs?.dropdown?.text;
            this.templateSelected.primaryType = this.getProjectInfo.primary
        },
        */ 

        createNewEnvironment() {
            this.creatingEnvironment = true
        },

        redirectToNewEnvironment() {
            const redirectURL = window.location.pathname + window.location.search.replace('create-env', 'env-select')
            this.$refs.environmentDialog.beginEnvironmentCreation(redirectURL)
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
            'setUpdateObjectProjectPath'
        ])
    }
}
</script>
<template>
    <div>
        <!-- Banner Intro -->
        <gl-banner
            v-if="showBannerIntro"
            :title="bannerInfo.title"
            button-text="Learn More"
            button-link="https://www.onecommons.org/unfurl-cloud"
            variant="introduction"
            @close="handleClose">
            <p>
                You can view this project’s requirements, deployment templates, source or view a live preview of the app.
                <br>
                You can also create a new deployment template and edit or deploy this project using any of its templates.
            </p>
        </gl-banner>

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

            <div class="row mr-1 gl-mb-6 flex-row-reverse">
              <gl-button
                v-gl-modal.oc-templates-deploy
                :title="__('Deploy')"
                :aria-label="__('Deploy')"
                style="font-size: 1.25em; font-weight: bold; padding: 0.5em 0.75em"
                category="primary"
                variant="confirm"
                class="btn-uf-teal"
                type="button"
                @click="selectingEnvironment = true"
                >
                <div class="d-flex align-items-center">
                    <gl-icon :size="24" class="mr-2" name="upload"/>
                    {{ __('Deploy') }}
                </div>
              </gl-button>
            </div>
            <!-- Table -->
            <!--TableWithoutHeader :data-rows="getTemplatesList" :editable="hasEditPermissions" /-->

            <deployed-blueprints />

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
                

                <!-- Creating Environment --> 
                <environment-creation-dialog 
                    v-if="creatingEnvironment"
                    ref="environmentDialog"
                    @environmentNameChange="env => createEnvironmentName = env"
                    @cloudProviderChange="provider => createEnvironmentProvider = provider"
                    /> 
                <!-- Selecting Environment --> 
                <div v-else-if="selectingEnvironment">
                    <p>{{ __("Select an environment to deploy into:") }}</p>
                    <gl-dropdown ref="dropdown" :text="defaultEnvironmentName">
                        <div v-if="getEnvironments.length > 0">
                            <gl-dropdown-item v-for="env in matchingEnvironments" @click="() => selectedEnvironment = env" :key="env.name">
                                <detect-icon :type="(env.primary_provider && env.primary_provider.type) || 'self-hosted'"/>
                                {{ env.name }}
                            </gl-dropdown-item>
                            <gl-dropdown-divider />
                        </div>
                        <gl-dropdown-item class="disabled" @click="createNewEnvironment">{{ __("Create new environment") }}</gl-dropdown-item>
                    </gl-dropdown>
                    <error-small :message="deployDialogError"/>
                </div>

                <!-- Selecting Blueprint --> 
                <div v-else-if="selectingBlueprint">
                    <p>Select a Deployment Blueprint for your <b>{{selectedEnvironment.name}}</b> Environment: </p>
                    <gl-dropdown class="col-md-3" :text="(templateSelected && templateSelected.title) || __('Select')">
                        <gl-dropdown-item @click="() => templateSelected = template" :key="template.name" v-for="template in blueprintsByEnvironment">
                            <detect-icon :type="template.cloud || 'self-hosted'" />
                            {{template.title}}
                        </gl-dropdown-item>
                    </gl-dropdown>
                    <gl-form-group
                        label="Name"
                        class="col-md-4 mt-4 align_left gl-pl-0"
                    >
                        <gl-form-input
                        id="input1"
                        v-model="templateForkedName"
                        name="input['template-name']"
                        type="text"
                        />

                    </gl-form-group>
                    <div v-if="instantiateAs!='template'"></div>
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
</style>
