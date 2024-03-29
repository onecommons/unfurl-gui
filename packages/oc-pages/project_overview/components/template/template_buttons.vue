<script>
import { GlButton } from '@gitlab/ui';
import { Tooltip as ElTooltip } from 'element-ui'
import {__} from '~/locale'
import _ from 'lodash'
import {mapGetters} from 'vuex'
import DeployButton from './deploy_button.vue'

export default {
    name: 'TemplateButtons',
    components: {
        GlButton,
        DeployButton,
        ElTooltip
    },
    props: {
        deployStatus: {type: String, default: () => 'disabled'},
        saveStatus: {type: String, default: () => 'disabled'},
        saveDraftStatus: {type: String, default: () => 'hidden'},
        mergeStatus: {type: String, default: () => 'disabled'},
        deleteStatus: {type: String, default: () => 'disabled'},
        cancelStatus: {type: String, default: () => 'hidden'},
        target: {type: String, default: () => 'template'},
        mergeRequest: Object,
        saveTooltip: String
    },

    methods: {
        // TODO these should just all be disabled after an interaction

        saveTemplate() {
            this.$emit('saveTemplate');
        },

        saveDraft() {
            this.$emit('saveDraft');
        },

        triggerDeploy: _.throttle(function (...args) {
            this.$emit('triggerDeploy', ...args);
        }, 3000),

        mergeRequestReady: _.throttle(function (...args) {
            this.$emit('mergeRequestReady', ...args);
        }, 3000),


        triggerLocalDeploy: _.throttle(function (...args) {
            this.$emit('triggerLocalDeploy', ...args);
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
            'editingDeployed',
            'getCurrentEnvironment',
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
                return __(`Please delete any deployments associated with this environment before continuing.`)
            }
            return __(`Delete ${this.target}`)
        },
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
            <el-tooltip :disabled="!saveTooltip">
                <template #content>
                    {{saveTooltip}}
                </template>
                <div>
                <gl-button
                    v-if="saveStatus != 'hidden'"
                    data-testid="save-template-btn"
                    :title="!saveTooltip && 'Save Changes'"
                    :aria-label="__('Save Changes')"
                    type="button"
                    icon="doc-new"
                    :disabled="saveStatus == 'disabled'"
                    class=""
                    @click.prevent="saveTemplate"
                    >{{ __('Save Changes') }}
                </gl-button>

                <gl-button
                    v-if="saveDraftStatus != 'hidden'"
                    data-testid="save-draft-btn"
                    :title="!saveTooltip && 'Save Changes'"
                    :aria-label="__('Save Changes')"
                    type="button"
                    icon="doc-new"
                    :disabled="saveDraftStatus == 'disabled'"

                    @click.prevent="saveDraft"
                    >{{ editingDeployed? __('Save Changes'): __('Save as Draft') }}
                </gl-button>
                </div>
            </el-tooltip>

            <gl-button
                v-if="mergeRequest"
                data-testid="view-merge-request"
                title="View Merge Request"
                aria-label="View Merge Request"
                target="_blank"
                type="button"
                icon="link"
                :href="mergeRequest.web_url"
            >
                View Merge Request
            </gl-button>

        </div>
        <DeployButton :deploy-status="deployStatus" @triggerDeploy="triggerDeploy" :mergeRequest="mergeRequest" @mergeRequestReady="mergeRequestReady" @triggerLocalDeploy="triggerLocalDeploy"/>
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
