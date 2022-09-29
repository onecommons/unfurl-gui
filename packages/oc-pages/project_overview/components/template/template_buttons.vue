<script>
import { GlButton } from '@gitlab/ui';
import {__} from '~/locale'
import _ from 'lodash'
import {mapGetters} from 'vuex'

export default {
    name: 'TemplateButtons',
    components: {
        GlButton
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
            const editingTarget = sessionStorage['editing-target']
            const editingDraftFrom = sessionStorage['editing-draft-from']
            // these don't need to be deleted because they will be overwritten by all current methods of editing a deployment
            //delete sessionStorage['editing-target']
            //delete sessionStorage['editing-draft-from']
            if(decodeURIComponent(location.href.slice(location.origin.length)) == editingTarget) {
                window.location.href = editingDraftFrom
            } else {
                // TODO re-enable this when we're able to update the current namespace 
                // https://github.com/onecommons/gitlab-oc/issues/867
                // this.$router.push({name: 'projectHome', slug: this.$route.params.slug})
                window.location.href = this.$router.resolve({name: 'projectHome', slug: this.$route.params.slug}).href
            }
        }
    },
    computed: {
        ...mapGetters([
            'hasPreparedMutations',
            'environmentHasActiveDeployments',
            'getCurrentEnvironment'
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
                title="Cancel Deployment"
                :aria-label="__('Cancel Deployment')"
                type="button"
                icon="cancel"
                class=""
                @click.prevent="cancelDeployment"
                >{{ __('Cancel Deployment') }}
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
                >{{ __('Save as Draft') }}</gl-button
            >

        </div>
        <div class="d-flex">
            <gl-button
                v-show="deployStatus != 'hidden'"
                title="Deploy"
                :aria-label="__('Deploy')"
                data-testid="deploy-button"
                type="button"
                icon="upload"
                class="deploy-action"
                :disabled="deployStatus == 'disabled'"
                @click.prevent="triggerDeploy"
                >{{ __('Deploy') }}</gl-button
            >
            <!--gl-button v-else type="button" class="deploy-action" loading>{{ __('Deploying...') }}</gl-button-->
        </div>
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
