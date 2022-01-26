<script>
import { GlModal, GlBanner, GlButton, GlModalDirective, GlDropdown, GlFormGroup, GlFormInput, GlDropdownItem, GlDropdownDivider } from '@gitlab/ui';
import TableWithoutHeader from '../../../vue_shared/components/oc/table_without_header.vue';
import { mapGetters, mapActions } from 'vuex';
import _ from 'lodash'
import { __ } from '~/locale';
import HeaderProjectView from '../../components/header.vue';
import ProjectDescriptionBox from '../../components/project_description.vue';
import { bus } from '../../bus';
import { slugify } from '../../../vue_shared/util'

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
            dropdownText: __("Select"),
            templateForkedName: null,
            resourceTemplateName: null,
            templateSelected: {},
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
            if(!this.templateForkedName || !this.resourceTemplateName) return true
            if(this.instantiateAs != 'template' && this.dropdownText == __("Select")) return true

            return false
        },
        ...mapGetters({
            environmentsList: 'getEnvironmentsList',
            projectInfo: 'getProjectInfo',
            templatesList: 'getTemplatesList',
            hasEditPermissions: 'hasEditPermissions'
        }),
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
            if(this.instantiateAs == 'deployment' && this.templateSelected?.slug)
                return {
                    fn: this.templateForkedName || undefined,
                    rtn: this.resourceTemplateName || undefined,
                    ts: this.templateSelected.slug || undefined

                }
            else return {}
        }
    },
    watch: {
        querySpec: _.debounce(function(query, oldQuery) {
            if(_.isEqual(query, oldQuery)) return
            const path = this.$route.path
            this.$router.replace({path, query})
        }, 100)

    },

    created() {
        this.syncGlobalVars(this.$projectGlobal);
        bus.$on('deployTemplate', (template) => {
            this.templateSelected = {...template};
            this.instantiateAs = 'deployment'
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
        const templateSelected = this.$route.query?.ts?
            this.$store.getters.getTemplatesList.find(template => template.slug == this.$route.query.ts) : null 
        if(templateSelected) {
            bus.$emit('deployTemplate', templateSelected)
            this.$refs['oc-templates-deploy'].show()

            this.templateForkedName = this.$route.query?.fn
            this.resourceTemplateName = this.$route.query?.rtn
        }
    },
    methods: {
        redirectToTemplateEditor(page='templatePage') {
            this.$router.push({ name: page, params: { slug: this.templateSelected.slug}});
        },

        clearModalTemplate() {
            this.dropdownText = __("Select");
            this.templateForkedName = null;
            this.resourceTemplateName = null;
            this.instantiateAs = null
        },

        instantiatePrimaryDeploymentTemplate() {
            this.instantiateAs = 'template'
            this.templateSelected = {...this.templatesList[0]};
            this.projectSlugName = '';
        },

        async onSubmitModal() {
            if (this.projectSlugName !== null) {
                this.prepareTemplateNew();
                await this.createDeploymentTemplate(this.templateSelected)
                if(this.instantiateAs == 'deployment'){
                    this.redirectToTemplateEditor('deploymentPage');
                } else {
                    this.redirectToTemplateEditor();
                }
            }

        },

        prepareTemplateNew() {
            this.templateSelected.title = this.templateForkedName;
            this.templateSelected.slug = slugify(this.templateForkedName);
            this.templateSelected.primary = this.resourceTemplateName
            this.templateSelected.totalDeployments = 0;
            this.templateSelected.environment = this.dropdownText;
            this.templateSelected.type = "deployment";
        },

        setEnvironmentName(envName) {
            this.dropdownText =  envName;
        },

        redirectToNewEnvironment() {
            const redirectTarget = `${window.location.pathname}${window.location.search}`
            const url = `${window.origin}${window.location.pathname.split("/").slice(0, -2).join("/")}/environments/new_unfurl?new_env_redirect_url=${encodeURIComponent(redirectTarget)}`;
            window.location = url;
        },

        handleClose() {
            this.showBannerIntro = false;
        },

        ...mapActions([
            'createDeploymentTemplate',
            'syncGlobalVars',
            'fetchProjectInfo'
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
        <HeaderProjectView :project-info="projectInfo" />

        <div v-if="projectInfo.name">
            <!-- Project Description -->
            <ProjectDescriptionBox 
                    :project-info="projectInfo"
                    :requirements="projectInfo.primary.requirements" 
                    :inputs="projectInfo.primary.properties" 
                    :outputs="projectInfo.primary.outputs"
                    :project-description="projectInfo.description"
                    :project-image="projectInfo.image"
                    :live-url="projectInfo.livePreview"
                    :project-name="projectInfo.name"
                    :project-title="projectInfo.title"
                    :code-source-url="projectInfo.sourceCodeUrl"
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
            <TableWithoutHeader :data-rows="templatesList" :editable="hasEditPermissions" />

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
                <gl-form-group
                    label="Resource name"
                    class="col-md-4 align_left gl-pl-0"
                >
                    <gl-form-input
                    v-model="resourceTemplateName"
                    name="input['resource-template-name']"
                    type="text"
                    />

                </gl-form-group>
                <div v-if="instantiateAs!='template'">
                    <p>{{ __("Select an environment to deploy this template to:") }}</p>
                    <gl-dropdown :text="dropdownText">
                        <div v-if="environmentsList.length > 0">
                            <gl-dropdown-item v-for="(env , idx) in environmentsList" :key="idx" @click="setEnvironmentName(env.name)">{{ env.name }}</gl-dropdown-item>
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
