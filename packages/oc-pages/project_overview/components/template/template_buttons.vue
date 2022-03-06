<script>
import { GlButton } from '@gitlab/ui';

import {mapGetters} from 'vuex'

export default {
    name: 'TemplateButtons',
    components: {
        GlButton
    },
    props: {
        loadingDeployment: {
            type: Boolean,
            required: true,
        },
        deployButton: {
            type: Boolean,
            required: true,
        },
        deployStatus: {type: String, default: () => 'disabled'},
        saveStatus: {type: String, default: () => 'disabled'},
        mergeStatus: {type: String, default: () => 'disabled'},
        deleteStatus: {type: String, default: () => 'disabled'},
        cancelStatus: {type: String, default: () => 'hidden'},
        target: {type: String, default: () => 'template'}

    },

    methods: {
        saveTemplate() {
            this.$emit('saveTemplate');
        },

        triggerDeploy() {
            this.$emit('triggerDeploy');
        },

        launchModalDeleteTemplate() {
            this.$emit('launchModalDeleteTemplate');
        },

        cancelDeployment() {
            this.$router.push({name: 'projectHome', slug: this.$route.params.slug})
        }
    },
    computed: {
        ...mapGetters(['hasPreparedMutations'])

    }
}
</script>
<template>
    <div class="gl-mt-6 gl-mb-6 d-flex justify-content-end">
        <div>
            <gl-button
                v-show="mergeStatus != 'hidden'"
                title="Merge Request"
                :aria-label="__(`Merge Request`)"
                icon="merge-request-open"
                type="button"
                class="gl-mr-3"
                :disabled="mergeStatus == 'disabled'"
                >{{ __('Merge Request') }}</gl-button
            >
            <gl-button
                v-show="deleteStatus != 'hidden'"
                title="Delete Template"
                :aria-label="__(`Delete Template`)"
                type="button"
                icon="remove"
                :disabled="deleteStatus == 'disabled'"
                class="gl-mr-3"
                @click.prevent="launchModalDeleteTemplate"
                >{{ __(`Delete ${target}`) }}</gl-button
            >
            <gl-button
                v-show="cancelStatus != 'hidden'"
                title="Cancel Deployment"
                :aria-label="__(`Cancel Deployment`)"
                type="button"
                icon="cancel"
                class="gl-mr-3"
                @click.prevent="cancelDeployment"
                >{{ __('Cancel Deployment') }}
            </gl-button>
            <gl-button
                v-show="saveStatus != 'hidden'"
                data-testid="save-template-btn"
                title="Save Changes"
                :aria-label="__(`Save Changes`)"
                type="button"
                variant="confirm"
                icon="doc-new"
                :disabled="saveStatus == 'disabled'"
                class="gl-mr-3"
                @click.prevent="saveTemplate"
                >{{ __('Save Changes') }}</gl-button
            >
        </div>
        <div>
            <gl-button
                v-show="deployStatus != 'hidden'"
                title="Deploy"
                :aria-label="__(`Deploy`)"
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
