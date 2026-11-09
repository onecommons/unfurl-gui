<script lang="ts">
import {defineComponent} from 'vue'
import { GlIcon, GlCard, GlTabs, GlModal, GlModalDirective, GlFormGroup, GlFormInput, GlMarkdown, GlFormRadio, GlLink } from '@gitlab/ui';
import TableWithoutHeader from 'oc_vue_shared/components/oc/table_without_header.vue';
import { mapGetters, mapActions, mapMutations } from 'vuex';
import _ from 'lodash'
import { s__, __, n__ } from '~/locale';
import HeaderProjectView from '../../components/header.vue';
import ProjectDescriptionBox from '../../components/project_description.vue';
import EnvironmentCreationDialog from '../../components/environment-creation-dialog.vue'
import YourDeployments from '../../components/your-deployments.vue'
import OpenCloudDeployments from '../../components/open-cloud-deployments.vue'
import LocalDevelop from '../../components/local-develop.vue'
import { MarkdownView, OcTab, EnvironmentSelection, BaseDeployDialog } from 'oc_vue_shared/components/oc'
import { bus } from 'oc_vue_shared/bus';
import { slugify } from 'oc_vue_shared/util'
import { fetchUserHasWritePermissions, fetchCurrentTag, fetchBranches } from 'oc_vue_shared/client_utils/projects'
import { blueprintDefaultBranch } from 'oc_vue_shared/mixins/default-branch'
import { lookupCloudProviderShortName, queryParamVar } from 'oc_vue_shared/util'
import { createDeploymentTemplate } from '../../store/modules/deployment_template_updates'
import * as routes from '../../router/constants'

const standalone = window.gon.unfurl_gui

type Json = Record<string, any>
// a repository tag as the API returns it
interface Tag {name: string, commit?: {id: string}}

export default defineComponent({
    emits: ['deployTemplate'],
    name: 'ProjectPageHome',
    i18n: {
        buttonLabel: __('Create new template'),
    },
    mixins: [blueprintDefaultBranch],
    components: {
        OcTab,
        EnvironmentSelection,
        BaseDeployDialog,
        GlModal,
        GlCard, GlIcon, GlTabs,
        GlFormGroup,
        GlFormInput,
        GlFormRadio,
        HeaderProjectView,
        TableWithoutHeader,
        EnvironmentCreationDialog,
        ProjectDescriptionBox,
        YourDeployments,
        OpenCloudDeployments,
        GlMarkdown,
        MarkdownView,
        GlLink,
        LocalDevelop
    },
    directives: {
        GlModal: GlModalDirective,
    },
    data() {
        return {
            triedPopulatingDeploymentItems: false,
            instantiateAs: null as 'deployment-draft' | 'template' | null,
            projectSlugName: null as string | null,
            templateForkedName: null as string | null,
            templateSelected: null as Json | null,
            selectedEnvironment: null as Json | null,
            newEnvironmentProvider: null as string | null | undefined,
            hasEditPermissions: false,
            creatingEnvironment: false,
            createEnvironmentName: '',
            createEnvironmentProvider: '',
            modalNextStatus: true,
            showBannerIntro: true,
            submitting: false,
            currentTag: null as Tag | null,
            version: null as string | null | undefined,
            mainBranchCommitId: null as string | null | undefined,
            bannerInfo: {
                title: __(`Deploy ${this.$projectGlobal.projectName}`),
                description: ""
            },
            currentTab: 0,
            standalone,
            baseDialogComplete: false
        }
    },
    computed: {
        ...mapGetters([
            'yourDeployments',
            'getApplicationBlueprint',
            'getPrimaryDeploymentBlueprint',
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
        ...queryParamVar('ts'),
        ...queryParamVar('tn'),
        ...queryParamVar('fn'),
        ...queryParamVar('bprev'),
        ...queryParamVar('env'),
        shouldDisableSubmitTemplate() {
            if(this.standalone) {
                // NB: read baseDialogComplete first so Vue 2 tracks it as a
                // reactive dep — otherwise the `$refs` short-circuit (refs
                // aren't reactive) on the initial compute leaves us
                // permanently cached as `true`.
                const complete = this.baseDialogComplete
                if(!this.$refs.baseDeployDialog) return true
                return !complete
            }

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
                const deploymentName = this.standalone ? this.fn : this.templateForkedName
                if(environment && deploymentName && this.lookupDeploymentOrDraft(slugify(deploymentName), environment)) {
                    return `'${deploymentName.trim()}' already exists in environment '${environment.name}'`
                }
            }
            return undefined
        },
        primaryProps() {
            return {
                text: __('Next'),
                attributes: {category: 'primary', variant: 'confirm', disabled: this.shouldDisableSubmitTemplate},
            };
        },
        cancelProps() {
            return {
                text: this.creatingEnvironment ? __('Back') : __('Cancel')
            };
        },
        useUnreleased() {
            if(!this.currentTag) return false
            const selectedVersion = this.standalone ? this.bprev : this.version
            return selectedVersion != this.currentTag.name
        },
        querySpec() {
            if(this.standalone) return {}
            if(this.instantiateAs == 'deployment-draft' && this.templateSelected?.name) {
                return {
                    fn: this.templateForkedName || undefined,
                    ts: this.projectSlugName || undefined,
                    tn: this.templateSelected.name || undefined,
                    bprev: this.useUnreleased ? this.version : undefined
                }
            }
            return {}
        },
        matchingEnvironments() {
            return this.getMatchingEnvironments(this.templateSelected?.cloud)
        },
        defaultEnvironmentName() {
            return (
                this.getLastUsedEnvironment({ cloud: this.templateSelected?.cloud }) || this.selectedEnvironment || this.getDefaultEnvironmentName(this.templateSelected?.cloud)
            )
        },
        commentsLinkText() {
            return n__('%d comment', '%d comments', this.commentsCount || 0)
        },
        mainAtLastest() {
            if(!this.mainBranchCommitId || !this.currentTag?.commit?.id) return false
            return this.mainBranchCommitId == this.currentTag.commit.id
        },
        shouldProvideVersionSelection() {
            if(!this.currentTag) return false
            if(!this.mainBranchCommitId) return false
            if(this.mainAtLastest) return false
            return true
        },
        modalOpen: {
            set(val: boolean) {
                if(val) return
                this.clearModalTemplate()
                this.baseDialogComplete = false
            },
            get() {
                return this.standalone ? !!this.ts : !!this.tn
            }
        },
    },
    watch: {
        querySpec(query, oldQuery) {
            if(this.standalone) return
            if(_.isEqual(query, oldQuery)) return

            const path = this.$route.path
            if(document.activeElement?.tagName == 'INPUT' && (document.activeElement as HTMLInputElement).type == 'text') {
                const el = document.activeElement as HTMLElement
                el.onblur = _ => {
                    this.$router.replace({ path, query })
                    el.onblur = null
                }
            } else {
                this.$router.replace({ path, query })
            }
        },
        templateSelected(val) {
            if(this.standalone) {
                if(val?.name) {
                    this.ts = val.name
                }
                return
            }

            if(this.templateForkedName) return
            if(val && this.instantiateAs == 'deployment-draft') {
                this.templateForkedName = this.getNextDefaultDeploymentName(
                    this.getApplicationBlueprint.title + ' ' + lookupCloudProviderShortName(val.cloud)
                )
            } else {
                this.templateForkedName = ''
            }
        },
        environmentsAreReady(newState, _oldState) {
            if(newState && this.yourDeployments.length) {
                this.populateDeploymentItems(this.yourDeployments)
            }
        },
        defaultEnvironmentName: {
            immediate: true,
            handler(val) {
                if(!this.selectedEnvironment) this.selectedEnvironment = this.lookupEnvironment(val)
            }
        },
        currentTag(currentTag) {
            if(!currentTag) return
            if(!this.version) {
                this.version = currentTag.name
            }
        }
    },
    created() {
        bus.$on('deployTemplate', (template: any) => {
            this.instantiateAs = 'deployment-draft'
            this.templateSelected = { ...template };
            this.projectSlugName = template.name;
        });

        bus.$on('editTemplate', (template: any) => {
            this.templateSelected = { ...template };
            this.redirectToTemplateEditor();
        });
    },
    beforeUnmount() {
        (function() {
            bus.$off('deployTemplate')
            bus.$off('editTemplate')
        })()
    },
    beforeMount() {
        if(this.$route.hash) {
            this.currentTab = 1
        }
    },
    async mounted() {
        const projectPath = this.$projectGlobal.projectPath

        fetchUserHasWritePermissions(projectPath).then(hasEditPermissions => this.hasEditPermissions = hasEditPermissions)
        if(!standalone) {
            this.fetchCommentsIssue()
        }
        const jobsListPromise = this.populateJobsList().catch(e => console.error('failed to lookup jobs: ', e.message))

        await this.loadPrimaryDeploymentBlueprint()
        if(this.hasCriticalErrors) return
        this.fetchCloudmap()

        if(this.environmentsAreReady && this.yourDeployments.length && !this.triedPopulatingDeploymentItems) {
            this.triedPopulatingDeploymentItems = true
            jobsListPromise.then(() => this.populateDeploymentItems(this.yourDeployments))
        }

        if(!standalone) {
            fetchCurrentTag(encodeURIComponent(this.$projectGlobal.projectPath)).then(tag => this.currentTag = tag ?? null)
        }

        ;(this.blueprintDefaultBranchPromise as Promise<string> | null)?.then(defaultBranch => {
            fetchBranches(encodeURIComponent(this.$projectGlobal.projectPath)).then(branches => this.mainBranchCommitId = branches.find(b => b.name == defaultBranch)?.commit?.id)
        })

        this.selectedEnvironment = this.lookupEnvironment(this.queryValue('env') || sessionStorage['instantiate_env'])
        this.newEnvironmentProvider = this.queryValue('provider') || sessionStorage['instantiate_provider']

        const selectedTemplateName = this.standalone ? this.ts : this.queryValue('ts')
        const templateSelected = selectedTemplateName ? this.getTemplatesList.find((template: Json) => template.name == selectedTemplateName) : null

        if(templateSelected) {
            bus.$emit('deployTemplate', templateSelected)
            if(this.standalone) {
                this.fn = this.queryValue('fn')
            } else {
                this.templateForkedName = this.queryValue('fn') ?? null
            }
        }

        this.version = this.queryValue('bprev')
    },
    methods: {
        queryValue(name: string): string | undefined {
            const value = this.$route.query[name]
            return (Array.isArray(value)? value[0]: value) ?? undefined
        },
        // the dialog cannot submit, and nothing redirects, without a template
        requireTemplate(): Json {
            if(!this.templateSelected) throw new Error('no template selected')
            return this.templateSelected
        },
        redirectToTemplateEditor(page = routes.OC_PROJECT_VIEW_CREATE_TEMPLATE) {
            const query = this.$route.query || {}
            if(Object.keys(query).length != 0) this.$router.replace({ query: {} })
            // Raw: this is a route param, and $router.resolve encodes it. Encoding
            // here too yields root%252Fdashboard, which matches no route.
            const dashboard = this.selectedEnvironment?._dashboard || this.getHomeProjectPath
            // TODO re-enable this when we're able to update the current namespace
            // https://github.com/onecommons/gitlab-oc/issues/867
            // this.$router.push({ query, name: page, params: { dashboard, environment: this.templateSelected.environment, slug: this.templateSelected.name }})
            const template = this.requireTemplate()
            window.location.href = this.$router.resolve({ query, name: page, params: { dashboard, environment: template.environment, slug: template.name } }).href
        },
        clearModalTemplate(e?: Event) {
            if(this.submitting && !this.standalone) return
            e?.preventDefault()
            this.templateForkedName = null
            this.templateSelected = null
            this.selectedEnvironment = null
            this.creatingEnvironment = false
            // One navigation: vue-router 4 updates $route only once a navigation
            // lands, so clearing these one setter at a time removed only the last
            // and left ?ts=, which mounted() reads to reopen this dialog.
            const query = {...this.$route.query}
            for(const param of ['ts', 'tn', 'bprev', 'env', 'fn']) delete query[param]
            if(!_.isEqual(query, this.$route.query)) this.$router.replace({...this.$route, query})
        },
        instantiatePrimaryDeploymentTemplate() {
            this.instantiateAs = 'template'
            this.templateSelected = { ...this.getTemplatesList[0] };
            this.projectSlugName = '';
        },
        async onSubmitModal(e: Event) {
            if(this.standalone) {
                return (this.$refs.baseDeployDialog as {performRedirect(e?: Event): void} | undefined)?.performRedirect(e)
            }

            if(this.creatingEnvironment) {
                e.preventDefault()
                this.redirectToNewEnvironment()
                return
            }
            if(this.projectSlugName !== null) {
                this.submitting = true
                this.prepareTemplateNew()

                if(this.instantiateAs == 'deployment-draft') {
                    const template = this.requireTemplate()
                    const lastUsedEnvironment = {
                        cloud: template.cloud,
                        environmentName: template.environment
                    }
                    this.updateLastUsedEnvironment({
                        lastUsedEnvironment,
                        username: this.getUsername
                    })

                    this.redirectToTemplateEditor(routes.OC_PROJECT_VIEW_DRAFT_DEPLOYMENT)
                } else {
                    // prepareTemplateNew filled these in
                    const {primary, primaryName, primaryType, name, title, slug, description} = this.requireTemplate()
                    this.pushPreparedMutation(createDeploymentTemplate({blueprintName: this.getApplicationBlueprint.name, primary, primaryName, primaryType, name, title, slug, description}))

                    await this.commitPreparedMutations()
                    this.redirectToTemplateEditor()
                }

                this.submitting = false
                this.clearModalTemplate()
            }
        },
        async loadPrimaryDeploymentBlueprint() {
            const projectPath = this.$projectGlobal.projectPath
            if(!projectPath) throw new Error('projectGlobal.projectPath is not defined')
            await this.fetchProject({ projectPath, blueprintPath: this.$route.query.blueprintPath })
            if(this.hasCriticalErrors) return
            const templateSlug = this.getPrimaryDeploymentBlueprint
            if(!templateSlug) return
            return await this.populateTemplateResources({
                projectPath,
                templateSlug,
            })
        },
        onCancelModal(e: Event) {
            if(this.standalone) return
            if(this.creatingEnvironment) {
                this.creatingEnvironment = false
                this.createEnvironmentName = ''
                this.createEnvironmentProvider = ''
                e.preventDefault()
            }
        },
        prepareTemplateNew() {
            const deploymentName = this.standalone ? this.fn : this.templateForkedName
            const template = this.requireTemplate()
            template.primary = template.title
            template.title = deploymentName
            template.name = slugify(deploymentName)
            template.totalDeployments = 0
            template.environment = this.selectedEnvironment?.name || this.defaultEnvironmentName
            template.primaryType = this.getApplicationBlueprint.primary
        },
        createNewEnvironment() {
            this.creatingEnvironment = true
        },
        redirectToNewEnvironment() {
            // Pass this page as the return target: the user is sent away to make
            // an environment and comes back here with it preselected. Without an
            // explicit target the dialog treats the trip as one-way.
            (this.$refs.environmentDialog as {beginEnvironmentCreation(target?: string): Promise<void>}).beginEnvironmentCreation(
                window.location.pathname + window.location.search
            )
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
})
</script>
<template>
    <div data-testid="project-home-page">
        <HeaderProjectView :project-info="getApplicationBlueprint" />

        <div v-if="getApplicationBlueprint && getApplicationBlueprint.name">
            <ProjectDescriptionBox
                    :project-info="getApplicationBlueprint"
                    />

            <gl-link v-if="commentsIssueUrl" :href="commentsIssueUrl" class="gl-mb-4 gl-inline-flex gl-items-center">
                <gl-icon name="comments" class="gl-mr-2"/>
                {{commentsLinkText}}
            </gl-link>

            <gl-tabs v-model="currentTab">
                <oc-tab ref="availableBlueprintsTab" title="Available Blueprints">
                    <div class="">
                        <gl-card>
                            <template #header>
                                <div class="gl-flex gl-items-center">
                                    <gl-icon name="archive" class="gl-mr-3"/>
                                    <h5 class="gl-mb-0 gl-mt-0">
                                        {{__('Available Deployment Blueprints')}}
                                    </h5>
                                </div>
                            </template>
                            <TableWithoutHeader :data-rows="getTemplatesList" :editable="hasEditPermissions" />
                        </gl-card>
                    </div>
                </oc-tab>
                <oc-tab v-if="hasEditPermissions && !standalone" ref="developmentTab" title="Develop">
                    <gl-card>
                        <template #header>
                            <div class="gl-flex gl-items-center">
                                <gl-icon name="archive" class="gl-mr-3"/>
                                    <h5 class="gl-mb-0 gl-mt-0">
                                        Local Unfurl Server Development
                                    </h5>
                            </div>
                        </template>
                        <local-develop />
                    </gl-card>
                </oc-tab>
                <oc-tab v-if="environmentsAreReady && yourDeployments.length > 0" ref="yourDeploymentsTab" title="Your Deployments">
                    <div class="">
                        <your-deployments />
                    </div>
                </oc-tab>
                <oc-tab v-if="openCloudDeployments.length > 0" ref="openCloudDeploymentsTab" title="Open Cloud Deployments">
                    <open-cloud-deployments />
                </oc-tab>
            </gl-tabs>

            <gl-card v-if="$projectGlobal.readme || $projectGlobal.readmeRaw">
                <template #header>
                    <div class="gl-flex gl-items-center">
                        <gl-icon name="information-o" class="gl-mr-3"/>
                        <h5 class="gl-mb-0 gl-mt-0">
                            {{__('README.md')}}
                        </h5>
                    </div>
                </template>

                <gl-markdown v-if="standalone">
                    <markdown-view :content="$projectGlobal.readmeRaw"/>
                </gl-markdown>
                <gl-markdown v-else class="md" v-html="$projectGlobal.readme" />
            </gl-card>

            <gl-modal
                ref="oc-templates-deploy"
                modal-id="oc-templates-deploy"
                v-model="modalOpen"
                :title="modalTitle"
                :action-primary="primaryProps"
                :action-cancel="cancelProps"
                no-fade
                @primary="onSubmitModal"
                @cancel="onCancelModal"
                @hidden="clearModalTemplate"
            >
                <base-deploy-dialog
                    v-if="standalone"
                    ref="baseDeployDialog"
                    @completionStatusSet="status => baseDialogComplete = status"
                    :project-path="$projectGlobal.projectPath"
                    :template-selected="templateSelected"
                    :application-blueprint="getApplicationBlueprint"
                />
                <template v-else>
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
                        <div class="deploy-dialog col-md-6" v-if="instantiateAs != 'template'">
                            <p>{{ __("Select an environment to deploy this template to:") }}</p>
                            <environment-selection
                                :model-value="selectedEnvironment"
                                @update:modelValue="selectedEnvironment = $event"
                                :provider="templateSelected && templateSelected.cloud"
                                :error="deployDialogError"
                                @createNewEnvironment="createNewEnvironment"
                                environment-creation
                            />

                            <div v-if="currentTag && shouldProvideVersionSelection" class="gl-mt-7">
                                <gl-form-radio v-model="version" :value="currentTag.name">Use the current release of {{ getApplicationBlueprint.title }}  (<b>{{ currentTag.name }}</b>)</gl-form-radio>
                                <gl-form-radio v-model="version" value="main"> Use the latest (unreleased) version</gl-form-radio>
                            </div>
                        </div>
                    </div>
                </template>
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

.dropdown-parent :deep(ul) { width: unset; }

.deploy-dialog :deep(.custom-control-input:checked ~ .custom-control-label::before) {
    background-color: #00D2D9 !important;
}
</style>
