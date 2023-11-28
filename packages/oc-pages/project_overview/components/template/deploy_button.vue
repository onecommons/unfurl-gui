<script>
import { mapGetters } from 'vuex'

import { Tooltip as ElTooltip } from 'element-ui'
import { GlButton, GlButtonGroup, GlDropdown, GlDropdownItem, GlFormCheckbox} from '@gitlab/ui';
import ErrorSmall from 'oc_vue_shared/components/oc/ErrorSmall.vue'
import { getTransientUnfurlServerOverride } from 'oc_vue_shared/client_utils/unfurl-server'

export default {
    name: 'DeployButton',
    components: {
        ElTooltip,
        ErrorSmall,
        GlButton, GlButtonGroup, GlDropdown, GlDropdownItem, GlFormCheckbox
    },
    data() {
        return {
            forceCheck: false,
            dryRun: false,
            localDeploy: false,
            isCypress: !!window.Cypress
        }
    },
    props: {
        deployStatus: String,
        mergeRequest: Object
    },
    methods: {
        triggerDeploy() {
            if(this.userCanEdit) {
                if(this.localDeploy) {
                    this.$emit('triggerLocalDeploy', {forceCheck: this.forceCheck, dryRun: this.dryRun})
                } else {
                    this.$emit('triggerDeploy', {forceCheck: this.forceCheck, dryRun: this.dryRun})
                }
            } else {
                this.$emit('mergeRequestReady', {status: !this.markedReady})
            }
        },
        triggerLocalDeploy() {
            this.$emit('triggerLocalDeploy', {forceCheck: this.forceCheck, dryRun: this.dryRun})
        },
        onInputForceCheck(val) { // val instead of an event
            this.forceCheck = val
        },
        onInputDryRun(val) {
            this.dryRun = val
        },
        onInputLocalDeploy(val) {
            this.localDeploy = val
        },
    },
    computed: {
        ...mapGetters([
            'editingDeployed',
            'editingTorndown',
            'cardIsValid',
            'deployTooltip',
            'getPrimaryCard',
            'userCanEdit'
        ]),
        canDeploy() {
            return this.cardIsValid(this.getPrimaryCard)
        },
        workInProgress() {
            return this.mergeRequest && this.mergeRequest.work_in_progress
        },
        markedReady() {
            return this.mergeRequest && !this.workInProgress
        },
        deployButtonText() {
            if(this.userCanEdit) {
                return 'Deploy'
            }
            if(this.markedReady) {
                return 'Mark as Draft'
            }
            return 'Mark as Ready'
        },
        deployButtonIcon() {
            if(this.userCanEdit) {
                return 'upload'
            }
            return 'merge-request-open'
        },
        showDeployOptionsFooter() {
            return this.userCanEdit
        },
        localDeployOnly() {
            // *not* reactive

            return !!getTransientUnfurlServerOverride()
        }
    }
}

</script>
<template>
    <el-tooltip :disabled="!deployTooltip">
        <template #content>
            <div>
                {{deployTooltip}}
            </div>
        </template>
        <div v-if="deployStatus != 'hidden' && !editingTorndown" class="d-flex deploy-button-wrapper">
            <div class="d-flex flex-column position-relative">
                <gl-button-group class="deploy-button">
                    <gl-button
                        :aria-label="deployButtonText"
                        variant="confirm"
                        data-testid="deploy-button"
                        :title="!deployTooltip? deployButtonText: null"
                        type="button"
                        :icon="deployButtonIcon"
                        class="deploy-action"
                        :disabled="deployStatus == 'disabled' && !markedReady"
                        @click.prevent="localDeployOnly? triggerLocalDeploy(): triggerDeploy()"
                    >
                        {{ localDeployOnly? 'Deploy Locally': deployButtonText}}
                    </gl-button>
                    <gl-dropdown v-if="userCanEdit" :disabled="deployStatus == 'disabled'" right>
                        <div class="mt-2"/>
                            <gl-form-checkbox data-testid="toggle-local-deploy" @input="onInputLocalDeploy" style="margin: 0.25rem 1rem;" >
                                <el-tooltip v-if="userCanEdit && deployStatus != 'disabled' && !localDeployOnly" placement="right">
                                    <template #content>
                                        Use Unfurl to deploy this from the command line
                                    </template>
                                <span> Deploy Locally </span>
                                </el-tooltip>
                            </gl-form-checkbox>
                            <gl-form-checkbox data-testid="toggle-force-check" @input="onInputForceCheck" style="margin: 0.25rem 1rem;" >
                                <el-tooltip v-if="userCanEdit && deployStatus != 'disabled'" placement="right">
                                    <template #content>
                                        Check status of a resource before creating or updating
                                    </template>

                                <span> Force Check </span>
                                </el-tooltip>
                            </gl-form-checkbox>
                            <gl-form-checkbox v-if="isCypress" data-testid="toggle-dry-run" @input="onInputDryRun" style="margin: 0.25rem 1rem;">
                                <el-tooltip v-if="userCanEdit && deployStatus != 'disabled'" placement="right">
                                    <template #content>
                                        Run a workflow without provisioning any cloud resources
                                    </template>
                                <span> Dry Run </span>
                                </el-tooltip>
                            </gl-form-checkbox>
                    </gl-dropdown>
                </gl-button-group>
                <error-small class="position-absolute" style="top: 2.25em; right: 0; width: 300px; text-align: right;" :condition="!canDeploy">
                    <div class="d-flex align-items-center justify-content-end">
                        <span style="line-height: 1;">Deployment is incomplete</span><i style="font-size: 1.25em;" class="el-icon-info ml-1"/>
                    </div>
                </error-small>
            </div>
        </div>
    </el-tooltip>

</template>
<style scoped>
.deploy-button >>> .gl-button {
    margin: 0!important;
    /* padding: 8px 12px !important; */
}

/*
.deploy-button >>> svg {
    margin-left: 0!important;
}
*/

/* Branding colors */
.deploy-button-wrapper >>> .gl-form-checkbox.custom-control .custom-control-input:checked ~ .custom-control-label::before,
.deploy-button-wrapper >>> .gl-form-radio.custom-control .custom-control-input:checked ~ .custom-control-label::before {
    background-color: #00D2D9 !important;
}
</style>
