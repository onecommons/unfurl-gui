<script>
import { mapGetters } from 'vuex'

import { Tooltip as ElTooltip } from 'element-ui'
import { GlButton, GlButtonGroup, GlDropdown, GlDropdownItem, GlFormCheckbox} from '@gitlab/ui';
import ErrorSmall from 'oc_vue_shared/components/oc/ErrorSmall.vue'

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
        }
    },
    props: {
        deployStatus: String,
        mergeRequest: Object
    },
    methods: {
        triggerDeploy() {
            if(this.userCanEdit) {
                this.$emit('triggerDeploy', {forceCheck: this.forceCheck})
            } else {
                this.$emit('mergeRequestReady', {status: !this.markedReady})
            }
        },
        triggerLocalDeploy() {
            this.$emit('triggerLocalDeploy', {forceCheck: this.forceCheck})
        },
        onInputForceCheck(val) { // val instead of an event
            this.forceCheck = val
        }
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
                        @click.prevent="triggerDeploy"
                    >
                        {{ deployButtonText }}
                    </gl-button>
                    <gl-dropdown v-if="userCanEdit" :disabled="deployStatus == 'disabled'" right>
                        <gl-dropdown-item @click="triggerLocalDeploy" variant="confirm">
                            Deploy Locally
                        </gl-dropdown-item>

                        <!-- spacers here make the tooltip a lot less annoying -->
                        <div v-if="showDeployOptionsFooter" class="mb-2"/>
                        <template v-if="showDeployOptionsFooter" #footer>
                            <div v-if="showDeployOptionsFooter" class="mt-2"/>
                            <el-tooltip v-if="userCanEdit && deployStatus != 'disabled'">
                                <template #content>
                                    Check status of a resource before creating or updating
                                </template>

                                <gl-form-checkbox @input="onInputForceCheck" style="margin: 0 1rem;" >
                                    <span> Force Check </span>
                                </gl-form-checkbox>
                            </el-tooltip>
                        </template>
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
