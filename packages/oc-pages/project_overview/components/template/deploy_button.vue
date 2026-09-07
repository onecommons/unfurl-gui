<script>
import { mapGetters } from 'vuex'

import { GlButton, GlButtonGroup, GlDropdown, GlDropdownItem, GlFormCheckbox, GlIcon, GlTooltipDirective} from '@gitlab/ui';
import ErrorSmall from 'oc_vue_shared/components/oc/ErrorSmall.vue'
import Autostop from 'oc_vue_shared/components/oc/autostop.vue'
import { getTransientUnfurlServerOverride } from 'oc_vue_shared/client_utils/unfurl-server'

const standalone = window.gon.unfurl_gui

export default {
    name: 'DeployButton',
    directives: {
        GlTooltip: GlTooltipDirective,
    },
    components: {
        ErrorSmall,
        Autostop,
        GlButton, GlButtonGroup, GlDropdown, GlFormCheckbox, GlIcon
    },
    data() {
        return {
            forceCheck: false,
            dryRun: false,
            localDeploy: false,
            isCypress: !!window.Cypress,
            standalone
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
        canAutoStop() {
            return this.userCanEdit && !this.editingDeployed && !this.editingTorndown && !standalone
        },
        workInProgress() {
            return this.mergeRequest && this.mergeRequest.work_in_progress
        },
        markedReady() {
            return this.mergeRequest && !this.workInProgress
        },
        deployButtonText() {
            if(this.userCanEdit) {
                if(this.editingDeployed) {
                    return 'Deploy Changes'
                }
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

            return standalone || !!getTransientUnfurlServerOverride()
        }
    }
}

</script>
<template>
    <div v-if="deployStatus != 'hidden' && !editingTorndown" class="gl-flex deploy-button-wrapper gl-relative">
        <autostop v-if="canAutoStop" class="gl-mr-3"/>
            <div class="gl-flex gl-flex-col gl-relative" data-testid="deploy-button-tooltip" v-gl-tooltip.hover :title="deployTooltip">
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
                    <gl-dropdown v-if="userCanEdit && !standalone" :disabled="deployStatus == 'disabled'" right>
                        <div class="gl-mt-3"/>
                            <gl-form-checkbox v-if="!localDeployOnly" data-testid="toggle-local-deploy" @input="onInputLocalDeploy" style="margin: 0.25rem 1rem;" >
                                <span v-if="userCanEdit && deployStatus != 'disabled'" v-gl-tooltip.hover.right
                                      title="Use Unfurl to deploy this from the command line"> Deploy Locally </span>
                            </gl-form-checkbox>
                            <gl-form-checkbox data-testid="toggle-force-check" @input="onInputForceCheck" style="margin: 0.25rem 1rem;" >
                                <span v-if="userCanEdit && deployStatus != 'disabled'" v-gl-tooltip.hover.right
                                      title="Check status of a resource before creating or updating"> Force Check </span>
                            </gl-form-checkbox>
                            <gl-form-checkbox v-if="isCypress" data-testid="toggle-dry-run" @input="onInputDryRun" style="margin: 0.25rem 1rem;">
                                <span v-if="userCanEdit && deployStatus != 'disabled'" v-gl-tooltip.hover.right
                                      title="Run a workflow without provisioning any cloud resources"> Dry Run </span>
                            </gl-form-checkbox>
                    </gl-dropdown>
                </gl-button-group>
                <error-small class="gl-absolute" style="top: 2.25em; right: 0; width: 300px; text-align: right;" :condition="!canDeploy">
                    <div class="gl-flex gl-items-center gl-justify-end">
                        <span style="line-height: 1;">Deployment is incomplete</span><gl-icon name="information-o" :size="16" class="gl-ml-2"/>
                    </div>
                </error-small>
            </div>
    </div>

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
