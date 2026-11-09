<script lang="ts">
import {defineComponent} from 'vue'
import { __ } from '~/locale'
import { mapGetters, mapActions, mapMutations } from 'vuex'
import { GlModal, GlDropdown, GlDropdownItem, GlLoadingIcon} from '@gitlab/ui';
import { queryParamVar, STD_REPOSITORY_URL } from 'oc_vue_shared/util'
import _ from 'lodash'
import { unfurlServerExport} from 'oc_vue_shared/client_utils/unfurl-server'
import type {ExportResponse} from 'oc_vue_shared/client_utils/unfurl-server'
import OcListResource from '../../project_overview/components/shared/oc_list_resource.vue'
import { BaseDeployDialog } from 'oc_vue_shared/components/oc'
const NEW_DEPLOYMENT_HASH = '#new-deployment'
// the query parameters the template step sets
const TEMPLATE_STEP_PARAMS = ['blueprintProject', 'ts', 'fn', 'bprev', 'env', 'provider']

type Json = Record<string, any>
interface BaseDeployDialogRef {
    creatingEnvironment: boolean
    redirectToNewEnvironment(): void
    redirectToTemplateEditor(): void
}


export default defineComponent({
    name: 'DashboardDeployDialog',
    components: {
        GlModal,
        OcListResource,
        GlDropdown, GlDropdownItem, GlLoadingIcon,
        BaseDeployDialog
    },
    data() {
        return {
            selectedBlueprint: null as Json | null,
            blueprintExport: null as ExportResponse | null | undefined,
            blueprints: [] as Json[],
            baseDialogComplete: false,
        }
    },
    methods: {
        ...mapActions([
            'environmentFetchTypesWithParams',
        ]),
        ...mapMutations([
            'createError',
        ]),
        async doSetup() {
            await this.environmentFetchTypesWithParams({
                environmentName: this.exportEnvironmentName,
                options: {
                    fallbackTypeRepository: {
                        url: STD_REPOSITORY_URL
                    }
                }
            })
            const types: Record<string, any> = this.environmentResourceTypeDict(this.exportEnvironmentName) || {}
            this.blueprints = Object.values(types).filter(t => t.directives?.includes('substitute'))
            if(this.blueprints.length == 0) {
                this.createError({
                    message: 'No valid blueprints found',
                    context: {
                        environmentName: this.exportEnvironmentName,
                        visibleTypes: Object.values(types).map(type => type.name)
                    }
                })
            }
        },
        primarySelectTemplate() {
            const baseDeployDialog = this.$refs.baseDeployDialog as BaseDeployDialogRef | undefined
            if(baseDeployDialog) {
                if(baseDeployDialog.creatingEnvironment) {
                    baseDeployDialog.redirectToNewEnvironment()
                } else {
                    baseDeployDialog.redirectToTemplateEditor()
                }
            }
        },
        primarySelectAppBlueprint() {
            // Next is disabled until a blueprint is selected
            if(!this.selectedBlueprint) return
            this.blueprintProject = (new URL(this.selectedBlueprint._sourceinfo.url))
                .pathname
                .slice(1)
                .replace(/\.git$/, '')
        },
        primaryAction(e: Event) {
            e.preventDefault()
            if(this.stage == 'SelectTemplate') return this.primarySelectTemplate()
            return this.primarySelectAppBlueprint()
        },
        // One navigation: vue-router 4 updates $route only once a navigation
        // lands, so clearing the parameters one setter at a time had each
        // replace the last, and only the final one was ever removed.
        queryWithoutTemplateStep() {
            const query = {...this.$route.query}
            for(const param of TEMPLATE_STEP_PARAMS) delete query[param]
            return query
        },
        backSelectTemplate() {
            this.$router.replace({...this.$route, query: this.queryWithoutTemplateStep()})
            this.baseDialogComplete = false
        },
        backSelectAppBlueprint() {
            this.navigateToHash('')
        },
        // vue-router 4 only listens for popstate, so assigning window.location.hash
        // moved the URL without moving $route.hash -- which is what `enabled` reads.
        navigateToHash(hash: string) {
            if(this.$route.hash == hash) return

            this.$router.push({...this.$route, hash})
        },
        back(e?: Event) {
            e?.preventDefault()
            if(this.stage == 'SelectTemplate') return this.backSelectTemplate()
            return this.backSelectAppBlueprint()
        },
        // Back to the start and closed, in one navigation. This looped on
        // `stage` until the route caught up, which under vue-router 4 is never
        // within the loop.
        reset(e?: Event){
            e?.preventDefault()
            const query = this.queryWithoutTemplateStep()
            this.baseDialogComplete = false
            if(this.$route.hash == '' && _.isEqual(query, this.$route.query)) return
            this.$router.push({...this.$route, query, hash: ''})
        },
    },
    computed: {
        ...mapGetters([
            'environmentsAreReady',
            'environmentResourceTypeDict',
        ]),
        primaryProps() {
            return {
                text: __('Next'),
                attributes: {category: 'primary', variant: 'confirm', disabled: this.nextIsDisabled},
            };
        },
        cancelProps() {
            return {
                text: this.stage == 'SelectAppBlueprint'? __('Cancel'): __('Back')
            };
        },
        enabled: {
            get() {
                return (
                    this.$route.hash == NEW_DEPLOYMENT_HASH ||
                    !!this.blueprintProject
                )
            },
            set(val: boolean) {
                if(val) {
                    this.navigateToHash(NEW_DEPLOYMENT_HASH)
                } else {
                    this.reset()
                }
            }
        },
        ...queryParamVar('blueprintProject'),
        ...queryParamVar('ts'),
        ...queryParamVar('fn'),
        ...queryParamVar('bprev'),
        ...queryParamVar('env'),
        ...queryParamVar('provider'),
        stage() {
            if(this.blueprintProject) return 'SelectTemplate'
            return 'SelectAppBlueprint'
        },
        ready() {
            return this.enabled && this.environmentsAreReady
        },
        exportEnvironmentName() {
            return this.$route.name == 'dashboardEnvironments' ?
                this.$route.params.name :
                'defaults'
        },
        deploymentTemplates(): any[] {
            if(! this.blueprintExport?.DeploymentTemplate) {
                return []
            }

            return Object.values(this.blueprintExport.DeploymentTemplate)
        },
        nextDisabledSelectTemplate() {
            return !this.selectedTemplate || !this.baseDialogComplete
        },
        nextDisabledSelectAppBlueprint() {
            return !this.selectedBlueprint
        },
        nextIsDisabled() {
            if(this.stage == 'SelectTemplate') return this.nextDisabledSelectTemplate
            return this.nextDisabledSelectAppBlueprint
        },
        applicationBlueprint() {
            return (this.blueprintExport && Object.values(this.blueprintExport.ApplicationBlueprint)[0]) ?? null
        },
        selectedTemplate() {
            if(! (this.ts && this.deploymentTemplates)) {
                return null
            }
            return this.deploymentTemplates.find(dt => dt.name == this.ts)
        }

    },
    watch: {
        ready: {
            immediate: true,
            async handler(val) {
                if(val) await this.doSetup()
            }
        },
        blueprintProject: {
            immediate: true,
            async handler(val) {
                if(val) {
                    this.blueprintExport = await unfurlServerExport({
                        format: 'blueprint',
                        projectPath: val,
                    })
                } else {
                    this.blueprintExport = null
                }
            }
        },
    }
})
</script>
<template>
    <gl-modal
        modalId="new-deployment"
        title="New Deployment"
        v-model="enabled"
        @primary="primaryAction"
        @cancel="back"
        :action-primary="primaryProps"
        :action-cancel="cancelProps"
        @hidden="reset"
        >
        <oc-list-resource v-if="stage == 'SelectAppBlueprint'" v-model="selectedBlueprint"
            :valid-resource-types="blueprints" />
        <gl-loading-icon v-if="stage == 'SelectAppBlueprint' && blueprints.length == 0" size="lg"/>

        <div v-if="stage == 'SelectTemplate'">
            <gl-dropdown v-if="deploymentTemplates.length > 0" class="col-md-6 gl-mb-6">
                <gl-dropdown-item v-for="dt in deploymentTemplates" :key="dt.name" @click="ts = dt.name">
                    <div class="">
                        <span class=" title">{{ dt.title || dt.name }}</span>
                    </div>
                    <div class="">
                        <div class="light-gray"><oc-markdown-view :content="dt.description" /></div>
                    </div>
                </gl-dropdown-item>
                <template #button-text>
                    <span v-if="selectedTemplate"> {{selectedTemplate.title || selectedTemplate.name}} </span>
                    <span v-else> Select a Deployment Blueprint</span>
                </template>
            </gl-dropdown>
            <gl-loading-icon v-else size="lg" />
            <base-deploy-dialog
                    v-if="selectedTemplate"
                    ref="baseDeployDialog"
                    @completionStatusSet="status => baseDialogComplete = status"
                    :project-path="blueprintProject"
                    :template-selected="selectedTemplate"
                    :application-blueprint="applicationBlueprint"
                />
        </div>

    </gl-modal>
</template>
