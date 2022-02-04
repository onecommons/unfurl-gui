<script>
import { GlModal, GlBanner, GlButton, GlModalDirective, GlDropdown, GlFormGroup, GlFormInput, GlDropdownItem, GlDropdownDivider } from '@gitlab/ui';
import TableWithoutHeader from '../../../vue_shared/components/oc/table_without_header.vue';
import { mapGetters, mapActions, mapMutations } from 'vuex';
import _ from 'lodash'
import { __ } from '~/locale';
import HeaderProjectView from '../../components/header.vue';
import ProjectDescriptionBox from '../../components/project_description.vue';
import { bus } from '../../bus';
import { slugify, lookupCloudProviderAlias } from '../../../vue_shared/util.mjs'
import { createDeploymentTemplate } from '../../store/modules/deployment_template_updates.js'

export default {
    name: 'ProjectPageHome',
    i18n: {
        buttonLabel: __('Create new template'),
    },
    components: {
        GlModal,
        GlButton,
        GlFormGroup,
        GlFormInput,
        HeaderProjectView,
        TableWithoutHeader,
        GlDropdown,
        GlDropdownItem,
        GlDropdownDivider,
        ProjectDescriptionBox,
        GlBanner
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
            modalNextStatus: true,
            showBannerIntro: true,
            bannerInfo: {
                title: __(`Deploy ${this.$projectGlobal.projectName}`),
                description: ""
            }
        }
    },
    computed: {
        shouldDisableSubmitTemplate() {
            if(!this.templateForkedName) return true
            if(this.instantiateAs != 'template' && this.defaultEnvironmentName == __("Select")) return true

            return false
        },
        ...mapGetters([
            'getEnvironments',
            'getProjectInfo',
            'getTemplatesList',
            'hasEditPermissions',
            'getUsername',
            'getNextDefaultDeploymentName',
            'getMatchingEnvironments',
            'getDefaultEnvironmentName'
        ]),
        primaryProps() {
            return {
                text: __('Next'),
                attributes: [{ category: 'primary' }, { variant: 'info' }, { disabled:  this.shouldDisableSubmitTemplate}],
            };
        },
        cancelProps() {
            return {
                text: __('Cancel'),
            };
        },
        querySpec() {
            if(this.instantiateAs == 'deployment-draft' && this.templateSelected?.slug)
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
            this.projectSlugName = template.slug;
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
        this.selectedEnvironment = this.$route.query?.env
        this.newEnvironmentProvider = this.$route.query?.provider

        // add environment to environments.json
        // TODO break this off into a function
        if(this.selectedEnvironment && this.newEnvironmentProvider) {
            const primary_provider = {type: lookupCloudProviderAlias(this.newEnvironmentProvider), __typename: 'ResourceTemplate'}

            await this.updateEnvironment({
                envName: this.selectedEnvironment,
                patch: {primary_provider, connections: {primary_provider}}
            })
        }
        //

        const templateSelected = this.$route.query?.ts?
            this.$store.getters.getTemplatesList.find(template => template.slug == this.$route.query.ts) : null 
        
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
            this.$router.push({ query, name: page, params: { environment: this.templateSelected.environment, slug: this.templateSelected.slug}});
        },

        clearModalTemplate() {
            this.templateForkedName = null;
            this.templateSelected = null
            this.selectedEnvironment = null
        },

        instantiatePrimaryDeploymentTemplate() {
            this.instantiateAs = 'template'
            this.templateSelected = {...this.getTemplatesList[0]};
            this.projectSlugName = '';
        },

        async onSubmitModal() {
            if (this.projectSlugName !== null) {
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
                await this.commitPreparedMutations()

                if(this.instantiateAs == 'deployment-draft'){
                    this.redirectToTemplateEditor('deploymentDraftPage');
                } else {
                    this.redirectToTemplateEditor();
                }
            }

        },

        prepareTemplateNew() {
            this.templateSelected.primary = this.templateSelected.title
            this.templateSelected.title = this.templateForkedName;
            this.templateSelected.slug = slugify(this.templateForkedName);
            this.templateSelected.totalDeployments = 0;
            this.templateSelected.environment = this.$refs?.dropdown?.text;
            this.templateSelected.primaryType = this.getProjectInfo.primary
        },

        redirectToNewEnvironment() {
            const redirectTarget = `${window.location.pathname}${window.location.search}`
            const url = `${window.origin}${window.location.pathname.split("/").slice(0, -2).join("/")}/environments/new_redirect?new_env_redirect_url=${encodeURIComponent(redirectTarget)}`;
            window.location = url;
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
                    :inputs="getProjectInfo.primary.properties" 
                    :outputs="getProjectInfo.primary.outputs"
                    :project-description="getProjectInfo.description"
                    :project-image="getProjectInfo.image"
                    :live-url="getProjectInfo.livePreview"
                    :project-name="getProjectInfo.name"
                    :project-title="getProjectInfo.title"
                    :code-source-url="getProjectInfo.sourceCodeUrl"
                    />

            <!-- Create new template part -->
            <div class="row gl-mt-6 gl-mb-6">
                <div class="col-md-12 col-lg-6 d-flex">
                    <h2 class="oc-title-section">{{ s__('OcDeployments|Deployment Templates') }}</h2>
                </div>
                <div class="col-md-12 col-lg-6 d-inline-flex flex-wrap justify-content-lg-end">
                    <div class="d-inline-flex">
                        <div class="form-group inline gl-mt-4">
                            <gl-button
                                v-gl-modal.oc-templates-deploy
                                :title="$options.i18n.buttonLabel"
                                :aria-label="$options.i18n.buttonLabel"
                                category="primary"
                                variant="confirm"
                                class="btn-uf-teal"
                                type="button"
                                @click="instantiatePrimaryDeploymentTemplate"
                                >
                                {{ $options.i18n.buttonLabel}}
                            </gl-button>
                        </div>
                    </div>
                </div>
            </div>
            <!-- Table -->
            <TableWithoutHeader :data-rows="getTemplatesList" :editable="hasEditPermissions" />

            <!-- Modal -->
            <gl-modal
                ref="oc-templates-deploy"
                modal-id="oc-templates-deploy"
                :title="s__('OcDeployments|Create new deployment')"
                :action-primary="primaryProps"
                :action-cancel="cancelProps"
                no-fade
                @primary="onSubmitModal"
                @hidden="clearModalTemplate"
            >
                <gl-form-group
                    label="Name"
                    class="col-md-4 align_left gl-pl-0"
                >
                    <gl-form-input
                    id="input1"
                    v-model="templateForkedName"
                    name="input['template-name']"
                    type="text"
                    />

                </gl-form-group>
                <div v-if="instantiateAs!='template'">
                    <p>{{ __("Select an environment to deploy this template to:") }}</p>
                    <!-- selectedEnvironment ends up populating defaultEnvironmentName -->
                    <gl-dropdown ref="dropdown" :text="defaultEnvironmentName">
                        <div v-if="getEnvironments.length > 0">
                            <gl-dropdown-item v-for="(env , idx) in matchingEnvironments" @click="() => selectedEnvironment = env.name" :key="idx">{{ env.name }}</gl-dropdown-item>
                            <gl-dropdown-divider />
                        </div>
                        <gl-dropdown-item class="disabled" @click="redirectToNewEnvironment">{{ __("Create new environment") }}</gl-dropdown-item>
                    </gl-dropdown>
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
