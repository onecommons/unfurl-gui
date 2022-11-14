<script>
import { GlButton } from '@gitlab/ui';
import {__} from '~/locale'
import _ from 'lodash'
import {mapGetters} from 'vuex'
import {Tooltip as ElTooltip} from 'element-ui'
import ErrorSmall from 'oc_vue_shared/components/oc/ErrorSmall.vue'

export default {
    name: 'TemplateButtons',
    components: {
        GlButton,
        ElTooltip,
        ErrorSmall
    },
    props: {
        deployStatus: {type: String, default: () => 'disabled'},
        saveStatus: {type: String, default: () => 'disabled'},
        saveDraftStatus: {type: String, default: () => 'hidden'},
        mergeStatus: {type: String, default: () => 'disabled'},
        deleteStatus: {type: String, default: () => 'disabled'},
        cancelStatus: {type: String, default: () => 'hidden'},
        target: {type: String, default: () => 'template'}
    },

    methods: {
        saveTemplate() {
            this.$emit('saveTemplate');
        },
        saveDraft() {
            this.$emit('saveDraft');
        },
        triggerDeploy: _.throttle(function () {
            this.$emit('triggerDeploy');
        }, 3000),

        launchModalDeleteTemplate() {
            this.$emit('launchModalDeleteTemplate');
        },

        cancelDeployment() {
            this.$emit('cancelDeployment')
        }
    },
    computed: {
        ...mapGetters([
            'hasPreparedMutations',
            'environmentHasActiveDeployments',
            'getCurrentEnvironment',
            'editingDeployed',
            'editingTorndown',
            'getValidationStatuses',
            'cardIsValid',
            'getPrimaryCard',
            'deployTooltip',
            'getPrimaryCard'
        ]),
        disableDelete() {
            if(this.deleteStatus == 'disabled') return true
            if(this.target == 'Environment') { // TODO refactor this
                return this.environmentHasActiveDeployments(this.getCurrentEnvironment)
            }
            return false
        },
        deleteTitle() {
            if(this.target == 'Environment' && this.environmentHasActiveDeployments(this.getCurrentEnvironment)) { // TODO refactor this
                return __(`Environment cannot be deleted - you have active deployments.`)
            }
            return __(`Delete ${this.target}`)
        },
        canDeploy() {
            return this.cardIsValid(this.getPrimaryCard)
        }
    }
}
</script>
<template>
    <div class="gl-mt-6 gl-mb-6 d-flex justify-content-between template-buttons flex-wrap">
        <div class="d-flex">
            <gl-button
                v-show="mergeStatus != 'hidden'"
                title="Merge Request"
                :aria-label="__(`Merge Request`)"
                icon="merge-request-open"
                type="button"
                class=""
                :disabled="mergeStatus == 'disabled'"
                >{{ __('Merge Request') }}</gl-button
            >
            <gl-button
                v-show="deleteStatus != 'hidden'"
                :title="deleteTitle"
                :aria-label="deleteTitle"
                type="button"
                icon="remove"
                :disabled="disableDelete"
                class=""
                @click.prevent="launchModalDeleteTemplate"
                >{{ __(`Delete ${target}`) }}</gl-button
            >
            <gl-button
                v-show="cancelStatus != 'hidden'"
                :title="editingDeployed? 'Cancel': 'Cancel Deployment'"
                :aria-label="__('Cancel Deployment')"
                type="button"
                icon="cancel"
                :disabled="cancelStatus == 'disabled'"
                class=""
                @click.prevent="cancelDeployment"
                >{{ __(editingDeployed? 'Cancel': 'Cancel Deployment') }}
            </gl-button>
            <gl-button
                v-show="saveStatus != 'hidden'"
                data-testid="save-template-btn"
                title="Save Changes"
                :aria-label="__('Save Changes')"
                type="button"
                variant="confirm"
                icon="doc-new"
                :disabled="saveStatus == 'disabled'"
                class=""
                @click.prevent="saveTemplate"
                >{{ __('Save Changes') }}</gl-button
            >
            <gl-button
                v-show="saveDraftStatus != 'hidden'"
                data-testid="save-draft-btn"
                title="Save Changes"
                :aria-label="__('Save Changes')"
                type="button"
                icon="doc-new"
                :disabled="saveDraftStatus == 'disabled'"
                
                @click.prevent="saveDraft"
                >{{ editingDeployed? __('Save Changes'): __('Save as Draft') }}</gl-button
            >

        </div>
        <el-tooltip :disabled="!deployTooltip">
            <template #content>
                <div>
                    {{deployTooltip}}
                </div>
            </template>
            <div class="d-flex flex-column position-relative">
                <gl-button
                    v-show="deployStatus != 'hidden' && !editingTorndown"
                    :aria-label="__('Deploy')"
                    data-testid="deploy-button"
                    :title="!deployTooltip? 'Deploy': null"
                    type="button"
                    icon="upload"
                    class="deploy-action"
                    :disabled="deployStatus == 'disabled'"
                    @click.prevent="triggerDeploy"
                >
                    {{ __('Deploy') }}
                </gl-button>
                <error-small class="position-absolute" style="top: 2.25em; right: 0; width: 300px; text-align: right;" :condition="!canDeploy">
                    <div class="d-flex align-items-center justify-content-end">
                        <span style="line-height: 1;">Deployment is incomplete</span><i style="font-size: 1.25em;" class="el-icon-info ml-1"/>
                    </div>
                </error-small>
                <!--gl-button v-else type="button" class="deploy-action" loading>{{ __('Deploying...') }}</gl-button-->
        </div>
    </el-tooltip>
    </div>
</template>
<style scoped>
.template-buttons  >>> .gl-button {
    margin: 0.5em;
    margin-top: 0;
}
@media only screen and (max-width: 500px) {
  .template-buttons {
      flex-direction: column;
  }


  .template-buttons > * {

      flex-direction: column;
  }
}
</style>
