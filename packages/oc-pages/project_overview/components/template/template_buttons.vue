<script>
import { GlButton } from '@gitlab/ui';

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
        }
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
        }
    }
}
</script>
<template>
    <div class="row gl-mt-6 gl-mb-6">
        <div class="col-md-12 col-lg-6 d-flex">
            <gl-button
                title="Merge Request"
                :aria-label="__(`Merge Request`)"
                icon="merge-request-open"
                type="button"
                class="gl-mr-3"
                disabled
                >{{ __('Merge Request') }}</gl-button
            >
            <gl-button
                title="Save Template"
                :aria-label="__(`Save Template`)"
                type="button"
                icon="doc-new"
                class="gl-mr-3"
                @click.prevent="saveTemplate"
                >{{ __('Save Template') }}</gl-button
            >
            <gl-button
                title="Delete Template"
                :aria-label="__(`Delete Template`)"
                type="button"
                icon="remove"
                class="gl-mr-3"
                @click.prevent="launchModalDeleteTemplate"
                >{{ __('Delete Template') }}</gl-button
            >
        </div>
        <div class="col-md-12 col-lg-6 d-inline-flex flex-wrap justify-content-lg-end">
            <gl-button
                v-if="!loadingDeployment"
                title="Deploy"
                :aria-label="__(`Deploy`)"
                type="button"
                icon="upload"
                class="deploy-action"
                :disabled="!deployButton"
                @click.prevent="triggerDeploy"
                >{{ __('Deploy') }}</gl-button
            >
            <gl-button v-else type="button" class="deploy-action" loading>{{ __('Deploying...') }}</gl-button>
        </div>
    </div>
</template>
