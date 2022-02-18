<script>
import EnvironmentCreationDialog from '../../project_overview/components/environment-creation-dialog.vue'
import {GlModal} from '@gitlab/ui'
import {USER_HOME_PROJECT} from '../../vue_shared/util.mjs'
import {__} from '~/locale'
export default {
    name: 'CreateEnvironmentModal',
    components: {EnvironmentCreationDialog, GlModal},
    props: {
        visible: Boolean
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
        disablePrimary() {
            return !(this.cp && this.env && this.env != __('Select'))
        }
    },
    methods: {
        redirectToNewEnvironment() {
            const redirectTarget = `${window.location.pathname}${window.location.search}`
            const url = `${window.origin}/${window.gon.current_username}/${USER_HOME_PROJECT}/-/environments/new_redirect?new_env_redirect_url=${encodeURIComponent(redirectTarget)}`
            window.location.href = url
        },
        onModalChange(e) { this.$emit('change', e) }
    }
}
</script>
<template>
    <gl-modal modalId="create-env-modal" :visible="visible" @change="onModalChange" :title="s__('OcDeployments|Create New Environment')" :action-cancel="{text: __('Cancel')}" :action-primary="{text: __('Next'), attributes: {disabled: disablePrimary, variant: 'confirm'}}" @primary="redirectToNewEnvironment">
        <environment-creation-dialog @cloudProviderChange="cp => this.cp = cp" @environmentNameChange="env => this.env = env"/>
    </gl-modal>
</template>
