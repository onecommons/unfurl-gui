<script>
import { GlModal, GlBanner, GlButton, GlModalDirective, GlDropdown, GlFormGroup, GlFormInput, GlDropdownItem, GlDropdownDivider } from '@gitlab/ui';
import TableWithoutHeader from 'oc/vue_shared/components/oc/table_without_header.vue';
import { mapGetters } from 'vuex';
import { __ } from '~/locale';
import HeaderProjectView from '../../components/header.vue';
import ProjectDescriptionBox from '../../components/project_description.vue';
import { bus } from '../../index';

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
            projectSlugName: null,
            dropdownText: __("Select"),
            templateForkedName: null,
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
        ...mapGetters({
            environmentsList: 'getEnvironmentsList',
            projectInfo: 'getProjectInfo',
            templatesList: 'getTemplatesList'
        }),
        primaryProps() {
            return {
                text: __('Next'),
                attributes: [{ category: 'primary' }, { variant: 'info' }, { disabled:  this.dropdownText === __("Select") || this.modalNextStatus}],
            };
        },
        cancelProps() {
            return {
                text: __('Cancel'),
            };
        }
    },
    watch: {
        templateForkedName(val) {
            //  Activate next button with string more that one character
            if (val && val.length > 0) {
                this.modalNextStatus = false;
            } else {
                this.modalNextStatus = true;
            }
        }
    },
    created() {
        bus.$on('setTemplate', (template) => {
            this.templateSelected = {...template};
            this.projectSlugName = template.slug;
        });

        bus.$on('editTemplate', (template) => {
            this.templateSelected = {...template};
            this.redirectToTemplate();
        });
    },
    methods: {
        redirectToTemplate() {
            this.$router.push({ name: 'templatePage', params: { slug: this.templateSelected.slug}});
        },

        clearModalTemplate() {
            this.dropdownText = __("Select");
            this.modalNextStatus = false;
            this.templateForkedName = null;
        },

        setTemplateBase() {
            this.templateSelected = {...this.templatesList[0]};
            this.projectSlugName = '';
        },

        onSubmitModal() {
            if (this.projectSlugName !== null) {
                this.prepareTemplateNew();
                this.$store.dispatch('setTemplateSelected', this.templateSelected);
                this.$store.dispatch('createTemplate', { projectPath: this.$projectGlobal.projectPath});
                this.redirectToTemplate();
            }

        },

        prepareTemplateNew() {
            this.templateSelected.title = this.templateForkedName;
            this.templateSelected.slug = this.slugify(this.templateForkedName);
            this.templateSelected.totalDeployments = 0;
            this.templateSelected.environment = this.dropdownText;
            this.templateSelected.type = "deployment";
        },

        setEnvironmentName(envName) {
            this.dropdownText =  envName;
        },

        redirectToNewEnvironment() {
            const url = `${window.origin}${window.location.pathname.split("/").slice(0, -1).join("/")}/environments/new`;
            window.location = url;
        },

        slugify(text) {
            return text
                .toString() 
                .toLowerCase()
                .normalize('NFD')
                .trim()
                .replace(/\s+/g, '-')
                // eslint-disable-next-line no-useless-escape
                .replace(/[^\w\-]+/g, '')
                // eslint-disable-next-line no-useless-escape
                .replace(/\-\-+/g, '-');
        },

        handleClose() {
            this.showBannerIntro = false;
        },
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

        <div v-if="projectInfo.id">
            <!-- Project Description -->
            <ProjectDescriptionBox 
                    :requirements="projectInfo.requirements" 
                    :inputs="projectInfo.inputs" 
                    :outputs="projectInfo.outputs"
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
                                @click="setTemplateBase"
                                >
                                {{ $options.i18n.buttonLabel}}
                            </gl-button>
                        </div>
                    </div>
                </div>
            </div>
            <!-- Table -->
            <TableWithoutHeader :data-rows="templatesList" />

            <!-- Modal -->
            <gl-modal
                modal-id="oc-templates-deploy"
                :title="s__('OcDeployments|Create new deployment')"
                :action-primary="primaryProps"
                :action-cancel="cancelProps"
                no-fade
                @primary="onSubmitModal"
                @cancel="clearModalTemplate"
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
                <p>{{ __("Select an environment to deploy this template to:") }}</p>
                <gl-dropdown :text="dropdownText">
                    <div v-if="environmentsList.length > 0">
                        <gl-dropdown-item v-for="(env , idx) in environmentsList" :key="idx" @click="setEnvironmentName(env.name)">{{ env.name }}</gl-dropdown-item>
                        <gl-dropdown-divider />
                    </div>
                    <gl-dropdown-item class="disabled" @click="redirectToNewEnvironment">{{ __("Create new environment") }}</gl-dropdown-item>
                </gl-dropdown>
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
