<script>

import { __ } from '~/locale'
import { mapGetters, mapActions } from 'vuex'
import { GlModal, GlDropdown, GlDropdownItem } from '@gitlab/ui';
import { queryParamVar } from 'oc_vue_shared/util'
import { unfurlServerExport} from 'oc_vue_shared/client_utils/unfurl-server'
import OcListResource from '../../project_overview/components/shared/oc_list_resource.vue'
import { BaseDeployDialog } from 'oc_vue_shared/components/oc'
const NEW_DEPLOYMENT_HASH = '#new-deployment'

export default {
    name: 'DashboardDeployDialog',
    components: {
        GlModal,
        OcListResource,
        GlDropdown, GlDropdownItem,
        BaseDeployDialog
    },
    data() {
        return {
            selectedBlueprint: null,
            blueprintExport: null,
            blueprints: [],
            baseDialogComplete: false,
        }
    },
    methods: {
        ...mapActions([
            'environmentFetchTypesWithParams',
        ]),
        async doSetup() {
            await this.environmentFetchTypesWithParams({ environmentName: this.environmentName })
            const types = this.environmentResourceTypeDict(this.environmentName)
            this.blueprints = Object.values(types).filter(t => t.directives?.includes('substitute'))
        },
        primarySelectTemplate() {
            if(this.$refs.baseDeployDialog) {
                this.$refs.baseDeployDialog.redirectToTemplateEditor()
            }
        },
        primarySelectAppBlueprint() {
            this.blueprintProject = (new URL(this.selectedBlueprint._sourceinfo.url))
                .pathname
                .slice(1)
                .replace(/\.git$/, '')
        },
        primaryAction(e) {
            e.preventDefault()
            const fn = `primary${this.stage}`
            return this[fn]()
        },
        backSelectTemplate() {
            this.blueprintProject = undefined
            this.ts = undefined
            this.fn = undefined
            this.baseDialogComplete = false
        },
        backSelectAppBlueprint() {
            window.location.hash = ''
        },
        back(e) {
            e?.preventDefault()
            const fn = `back${this.stage}`
            return this[fn]()
        },
        reset(e){
            e?.preventDefault()
            while(this.stage != 'SelectAppBlueprint') {
                this.back()
            }
            this.back()
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
                attributes: [{ category: 'primary' }, { variant: 'confirm' }, {disabled: this.nextIsDisabled}],
            };
        },
        cancelProps() {
            return {
                text: this.stage == 'SelectAppBlueprint'? __('Cancel'): __('Back')
            };
        },
        enabled: {
            get() {
                return this.$route.hash == NEW_DEPLOYMENT_HASH
            },
            set(val) {
                // avoids duplicated navigation error
                if(val) {
                window.location.hash = val
                } else {
                    this.reset()
                }
            }
        },
        ...queryParamVar('blueprintProject'),
        ...queryParamVar('ts'),
        ...queryParamVar('fn'),
        stage() {
            if(this.blueprintProject) return 'SelectTemplate'
            return 'SelectAppBlueprint'
        },
        ready() {
            return this.enabled && this.environmentsAreReady
        },
        environmentName() {
            return this.$route.name == 'dashboardEnvironments' ?
                this.$route.params.name :
                'defaults'
        },
        deploymentTemplates() {
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
            const fn = `nextDisabled${this.stage}`
            return this[fn] ?? false
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
                        projectPath: val
                    })
                } else {
                    this.blueprintExport = null
                }
            }
        },
    }
}
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

        <div v-if="stage == 'SelectTemplate'">
            <gl-dropdown class="col-md-6 mb-4">
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
