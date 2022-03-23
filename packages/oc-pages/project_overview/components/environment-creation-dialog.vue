<script>
import axios from '~/lib/utils/axios_utils';
import { __ } from '~/locale';
import {USER_HOME_PROJECT} from '../../vue_shared/util.mjs'
import {GlFormGroup, GlFormInput, GlDropdown, GlDropdownItem} from '@gitlab/ui'
import LogosCloud from './shared/logos_cloud.vue'
import {DetectIcon} from '../../vue_shared/oc-components'
import {token} from '../../vue_shared/compat.js'

const SHORT_NAMES = {
    'Google Cloud Platform': 'gcp',
    'Amazon Web Services': 'aws',
    'Local Dev': ''
}

export default {
    components: {
        GlFormGroup,
        GlFormInput,
        GlDropdown,
        GlDropdownItem,
        DetectIcon,
    },
    data() {
        return {
            environmentName: '',
            cloudProvider: __('Select'),
            environmentsList: [
                'Google Cloud Platform',
                'Amazon Web Services',
                'Local Dev',
            ],
            SHORT_NAMES,
            token,
        }
    },
    computed: {
        action() {
            return `${window.origin}/${window.gon.current_username}/${USER_HOME_PROJECT}/-/environments`
        }
    },
    watch: {
        environmentName() {
            this.$emit('environmentNameChange', this.environmentName)
        },
        cloudProvider() {
            this.$emit('cloudProviderChange', this.cloudProvider)
        }
    },
    methods: {
        async beginEnvironmentCreation(_redirectTarget) {
            let redirectTarget = _redirectTarget || window.location.pathname + window.location.search
            // rails is settings params weird
            if(!redirectTarget.includes('?')) redirectTarget += '?'
            const url = `${window.origin}/${window.gon.current_username}/${USER_HOME_PROJECT}/-/environments/new_redirect?new_env_redirect_url=${encodeURIComponent(redirectTarget)}`
            await axios.get(url)
            this.$refs.form.submit()
        }
    }
}
</script>
<template>

    <div>
        <gl-form-group
            label="Environment Name"
            class="col-md-4 align_left gl-pl-0"
            >
            <gl-form-input
                v-model="environmentName"
                type="text"
                />
        </gl-form-group>

        <gl-form-group
            label="Cloud Provider"
            class="col-md-4 align_left gl-pl-0"
            >
            <div class="dropdown-parent">
                <gl-dropdown>
                    <template #button-text>
                        <div style="display: flex; align-items: center;"> <detect-icon class="mr-2" :type="cloudProvider" no-default/>{{cloudProvider || __('Select')}} </div>
                    </template>
                    <gl-dropdown-item :key="env" v-for="env in environmentsList" @click="() => cloudProvider = env">
                        <div style="display: flex; align-items: center;"> <detect-icon class="mr-2" :type="env"/><div style="white-space: pre">{{env}}</div> </div>
                    </gl-dropdown-item>
                </gl-dropdown>
            </div>
        </gl-form-group>
        <form class="d-none" ref="form" method="POST" :action="action">
            <input name="authenticity_token" :value="token">
            <input name="environment[name]" :value="environmentName">
            <input name="provider" :value="SHORT_NAMES[cloudProvider]">
        </form>
    </div>
</template>
<style scoped>

.dropdown-parent >>> ul { width: unset; }
</style>
