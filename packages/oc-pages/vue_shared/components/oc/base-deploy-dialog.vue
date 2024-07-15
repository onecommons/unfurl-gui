<script>
import { GlModalDirective, GlFormGroup, GlFormInput, GlFormRadio } from '@gitlab/ui';
import { mapGetters, mapActions } from 'vuex';
import _ from 'lodash'
import { __ } from '~/locale';
import EnvironmentCreationDialog from '../../../project_overview/components/environment-creation-dialog.vue'
import { EnvironmentSelection } from 'oc_vue_shared/components/oc'
import { slugify } from 'oc_vue_shared/util'
import { lookupCloudProviderShortName } from 'oc_vue_shared/util'
import { fetchCurrentTag, fetchBranches } from 'oc_vue_shared/client_utils/projects'
import { queryParamVar } from 'oc_vue_shared/util'
import {homeProjectDefaultBranch} from 'oc_vue_shared/mixins/default-branch'
import * as overview_routes from '../../../project_overview/router/constants'

const standalone = window.gon.unfurl_gui

export default {
    name: 'BaseDeployDialog',
    mixins: [homeProjectDefaultBranch],
    components: {
        EnvironmentSelection,
        GlFormGroup,
        GlFormInput,
        GlFormRadio,
        EnvironmentCreationDialog,
    },
    props: {
        templateSelected: {
            default: () => ({})
        },
        instantiateAs: {
            default: () => 'deployment-draft'
        },
        forceEnvCreation: Boolean,
        projectPath: String,
        applicationBlueprint: Object
    },
    directives: {
        GlModal: GlModalDirective,
    },
    data() {
        return {
            projectSlugName: null,
            selectedEnvironment: null,
            creatingEnvironment: false,
            createEnvironmentName: '',
            createEnvironmentProvider: '',
            currentTag: null,
            mainBranchCommitId: null,
            userSpecifiedDeploymentName: !!this.$route.query.fn, // hopefully we'll consider it to be user modified if they were redirected
            standalone
        }
    },
    computed: {
        ...queryParamVar('ts'),
        ...queryParamVar('fn'),
        ...queryParamVar('bprev'),
        ...queryParamVar('env'),

        deployDialogError() {
            if (this.instantiateAs == 'deployment-draft') {
                const environment = this.selectedEnvironment ?? null
                if (environment && this.lookupDeploymentOrDraft(slugify(this.fn), environment)) {
                    return `'${this.fn.trim()}' already exists in environment '${environment?.name || environment}'`
                }
            }
            return null
        },
        ...mapGetters([
            'getNextDefaultDeploymentName',
            'environmentsAreReady',
            'lookupEnvironment',
            'getMatchingEnvironments',
            'getDefaultEnvironmentName',
            'lookupDeploymentOrDraft',
            'lookupEnvironment',
            'getHomeProjectPath',
            'getLastUsedEnvironment',
        ]),

        mainAtLastest() {
            if (!this.mainBranchCommitId || !this.currentTag?.commit?.id) return false

            return this.mainBranchCommitId == this.currentTag.commit.id
        },

        shouldProvideVersionSelection() {
            if (!this.currentTag) return false
            if (!this.mainBranchCommitId) return false
            if (this.mainAtLastest) return false

            return true
        },

        _projectPath() {
            return this.projectPath || this.$projectGlobal?.projectPath
        },

        isIncomplete() {
            if(this.creatingEnvironment) {
                return !(this.createEnvironmentProvider && this.createEnvironmentName)
            }
            if(this.deployDialogError) return true
            if(!this.fn) return true
            if(this.instantiateAs != 'template' && !this.selectedEnvironment) return true

            return false
        },

        environmentSelectionFromUrl() {
            if(!this.environmentsAreReady) return null
            if(!this.env) return null

            return this.lookupEnvironment(this.env)
        }
    },
    watch: {
        templateSelected: {
            immediate: true,
            handler (val) {
                this.ts = val.name
                if (this.userSpecifiedDeploymentName) return
                if (val && this.instantiateAs == 'deployment-draft') {
                    this.fn = this.getNextDefaultDeploymentName(
                        this.applicationBlueprint?.title + ' ' + lookupCloudProviderShortName(val.cloud)
                    )
                }
                else this.fn = ''
            }

        },

        currentTag(currentTag) {
            if (!currentTag) return
            if (!this.bprev) {
                this.bprev = currentTag.name
            }
        },

        isIncomplete: {
            immediate: true,
            handler(val) {
                this.$emit('completionStatusSet', !val)
            }
        },
        // modal wants to set to false
        bprev() {
            if(this.bprev === false) this.bprev = undefined
        },

        environmentSelectionFromUrl: {
            immediate: true,
            handler() {
                if(!this.selectedEnvironment && this.environmentSelectionFromUrl) {
                    this.selectedEnvironment = this.environmentSelectionFromUrl
                }
            }
        }
    },
    methods: {
        ...mapActions(['updateLastUsedEnvironment']),
        redirectToTemplateEditor() {
            const query = this.$route.query || {}
            query.tn = query.ts
            if (Object.keys(query).length != 0) this.$router.replace({ query: {} })
            const dashboard = encodeURIComponent(this.selectedEnvironment?._dashboard || this.getHomeProjectPath)
            // TODO re-enable this when we're able to update the current namespace
            // https://github.com/onecommons/gitlab-oc/issues/867
            // this.$router.push({ query, name: page, params: { dashboard, environment: this.templateSelected.environment, slug: this.templateSelected.name}});
            const page = this.instantiateAs == 'deployment-draft'?
                overview_routes.OC_PROJECT_VIEW_DRAFT_DEPLOYMENT:
                overview_routes.OC_PROJECT_VIEW_CREATE_TEMPLATE

            // store the environment in local storage
            const lastUsedEnvironment = {
                cloud: this.templateSelected.cloud,
                environmentName: this.templateSelected.environment
            }

            this.updateLastUsedEnvironment({
                lastUsedEnvironment,
                username: this.getUsername
            })

            const route = { query, name: page, params: { dashboard, environment: this.selectedEnvironment.name, name: slugify(query.fn), slug: slugify(query.fn) } }
            if(this.$router.name == 'overview') {
                window.location.href = this.$router.resolve(route).href
            } else {
                // hack to leverage router
                sessionStorage['unfurl-gui:route'] = JSON.stringify(route)
                window.location.href = `/${this._projectPath}`
            }

        },
        createNewEnvironment() {
            this.creatingEnvironment = true
        },
        redirectToNewEnvironment() {
            this.$refs.environmentDialog.beginEnvironmentCreation()
        },

        performRedirect(e) {
            e?.preventDefault()
            if(this.creatingEnvironment) {
                this.redirectToNewEnvironment()
            } else {
                this.redirectToTemplateEditor()
            }
        }

    },
    async mounted() {
        if(!standalone) {
            fetchCurrentTag(encodeURIComponent(this._projectPath)).then(tag => this.currentTag = tag)
        }

        await this.homeProjectDefaultBranchPromise

        fetchBranches(encodeURIComponent(this._projectPath)).then(branches => this.mainBranchCommitId = branches.find(b => b.name == this.homeProjectDefaultBranch)?.commit?.id)
        if(sessionStorage['instantiate_env']) {
            this.env = sessionStorage['instantiate_env']
            delete sessionStorage['instantiate_env']
        }
    }
}
</script>
<template>
    <environment-creation-dialog v-if="applicationBlueprint && creatingEnvironment" ref="environmentDialog"
        @environmentNameChange="env => createEnvironmentName = env"
        @cloudProviderChange="provider => createEnvironmentProvider = provider"
        :cloud-provider="templateSelected && templateSelected.cloud" />
    <div v-else-if="applicationBlueprint">
        <gl-form-group label="Name" class="col-md-4 align_left">
            <gl-form-input id="input1" data-testid="deployment-name-input" @change="userSpecifiedDeploymentName = true" v-model="fn"
                name="input['template-name']" type="text" />

        </gl-form-group>
        <div class="deploy-dialog col-md-6" v-if="instantiateAs != 'template'">
            <p>{{ __("Select an environment to deploy this template to:") }}</p>
            <environment-selection v-model="selectedEnvironment" :provider="templateSelected && templateSelected.cloud"
                :error="deployDialogError" @createNewEnvironment="createNewEnvironment"
                :environment-creation="!standalone || forceEnvCreation" />

            <div v-if="shouldProvideVersionSelection" class="mt-5">
                <gl-form-radio v-model="bprev" :value="currentTag.name">Use the current release of
                    {{ applicationBlueprint.title }} (<b>{{ currentTag.name }}</b>)</gl-form-radio>
                <gl-form-radio v-model="bprev" :value="homeProjectDefaultBranch"> Use the latest (unreleased) version</gl-form-radio>
            </div>
        </div>
    </div>
</template>
<style scoped>
/* TODO move this into gitlab oc */
.deploy-dialog >>> .custom-control-input:checked ~ .custom-control-label::before {
    background-color: #00D2D9 !important;
}
</style>
