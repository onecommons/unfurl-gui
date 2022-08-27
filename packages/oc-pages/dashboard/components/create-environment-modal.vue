<script>
import {mapGetters} from 'vuex'
import EnvironmentCreationDialog from '../../project_overview/components/environment-creation-dialog.vue'
import {GlModal} from '@gitlab/ui'
import {slugify, USER_HOME_PROJECT} from 'oc_vue_shared/util.mjs'
import {__} from '~/locale'
export default {
    name: 'CreateEnvironmentModal',
    components: {EnvironmentCreationDialog, GlModal},
    props: {
        visible: Boolean,
        allowAny: Boolean
    },
    model: {
        prop: 'visible',
        event: 'change'
        
    },
    data() {
        return {
            cp: '', env: ''
        }
    },
    computed: {
        ...mapGetters(['getCurrentNamespace']),
        disablePrimary() {
            return !(this.cp && this.env && this.env != __('Select'))
        }
    },
    methods: {
        async redirectToNewEnvironment(e) {
            e.preventDefault()
            await this.$refs.environmentDialog.beginEnvironmentCreation(`/home/${this.getCurrentNamespace}/-/environments/${slugify(this.$refs.environmentDialog.environmentName)}`)
        },
    }
}
</script>
<template>
    <gl-modal modalId="create-env-modal" :visible="visible" @hidden="$emit('change', false)" :title="s__('OcDeployments|Create New Environment')" :action-cancel="{text: __('Cancel')}" :action-primary="{text: __('Next'), attributes: {disabled: disablePrimary, variant: 'confirm'}}" @primary="redirectToNewEnvironment">
        <environment-creation-dialog :allow-any="allowAny" ref="environmentDialog" @cloudProviderChange="cp => this.cp = cp" @environmentNameChange="env => this.env = env"/>
    </gl-modal>
</template>
