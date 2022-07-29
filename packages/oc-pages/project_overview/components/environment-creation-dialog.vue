<script>
import axios from '~/lib/utils/axios_utils';
import { __ } from '~/locale';
import _ from 'lodash'
import { slugify, USER_HOME_PROJECT } from 'oc_vue_shared/util.mjs'
import {postGitlabEnvironmentForm, initUnfurlEnvironment} from 'oc_vue_shared/client_utils/environments'
import {GlFormGroup, GlFormInput, GlDropdown, GlDropdownItem} from '@gitlab/ui'
import LogosCloud from './shared/logos_cloud.vue'
import {DetectIcon, ErrorSmall} from 'oc_vue_shared/oc-components'
import {lookupCloudProviderAlias} from 'oc_vue_shared/util.mjs'
import {token} from 'oc_vue_shared/compat.js'
import {mapGetters} from 'vuex'

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
        ErrorSmall
    },
    props: {
        cloudProvider: {
            type: String,
            required: false
        },
        allowAny: {
            type: Boolean,
            default: false
        }
    },
    data() {
        return {
            environmentName: '',
            selectedCloudProvider: __('Select'),
            SHORT_NAMES,
            token,
            nameStartsWithNumber: false,
            duplicateName: false
        }
    },
    computed: {
        ...mapGetters(['lookupEnvironment', 'getHomeProjectPath']),
        environmentsList() {
            const result = [
                'Google Cloud Platform',
                'Amazon Web Services',
                'Local Dev',
            ]

            if(this.allowAny) return result

            const cloudProviderName = lookupCloudProviderAlias(this.cloudProvider)

            //local dev not currently supported on other platforms
            //if(cloudProviderName) {
                return result.filter(envName => {
                    return lookupCloudProviderAlias(this.SHORT_NAMES[envName]) == cloudProviderName
                })
            //}

            return result
        },
        action() {
            return `${window.origin}/${this.getHomeProjectPath}/-/environments`
        }
    },
    watch: {
        environmentName:  _.debounce(function(val){
            if(this.nameStartsWithNumber = (/^\d/).test(this.environmentName)) {
                this.$emit('environmentNameChange', '')
            } else if(this.duplicateName = !!this.lookupEnvironment(slugify(this.environmentName))) {
                this.$emit('environmentNameChange', '')
            } else {
                this.$emit('environmentNameChange', slugify(this.environmentName))
            }
        }, 100),
        selectedCloudProvider() {
            this.$emit('cloudProviderChange', this.selectedCloudProvider)
        }
    },
    methods: {
        async createLocalDevEnvironment() {
          // this is an ugly hack, refactor to just submit the form
          sessionStorage['environmentFormEntries'] = JSON.stringify(Array.from((new FormData(this.$refs.form)).entries()))
          sessionStorage['environmentFormAction'] = this.action
          await postGitlabEnvironmentForm();
          const result = await initUnfurlEnvironment(
            this.getHomeProjectPath,
            {
              name: slugify(this.environmentName),
            }
          )
          return result
        },

        async beginEnvironmentCreation(_redirectTarget) {
            let redirectTarget = _redirectTarget || window.location.pathname + window.location.search
            // rails is settings params weird
            if (!redirectTarget.includes('?')) redirectTarget += '?'
            if (SHORT_NAMES[this.selectedCloudProvider]) {
              const url = `${window.origin}/${this.getHomeProjectPath}/-/environments/new_redirect?new_env_redirect_url=${encodeURIComponent(redirectTarget)}`
              sessionStorage['expect_cloud_provider_for'] = slugify(this.environmentName)
              await axios.get(url); // set redirect
            }
            sessionStorage['cancelTo'] = window.location.href
            sessionStorage['environmentFormEntries'] = JSON.stringify(Array.from((new FormData(this.$refs.form)).entries()))
            sessionStorage['environmentFormAction'] = this.action
            if (!SHORT_NAMES[this.selectedCloudProvider]) {
              await this.createLocalDevEnvironment()
              window.location.href = redirectTarget;
            } else {
              window.location.href = `/${this.getHomeProjectPath}/-/clusters/new?env=${slugify(this.environmentName)}&provider=${SHORT_NAMES[this.selectedCloudProvider]}`
            }
        },
        slugify
    },
    mounted() {
        if(this.environmentsList.length == 1) {
            this.selectedCloudProvider = this.environmentsList[0]
        }
    }
}
</script>
<template>

    <div>
        <gl-form-group
            label="Environment Name"
            class="col-md-4 align_left"
            >
            <gl-form-input
                data-testid="environment-name-input"
                v-model="environmentName"
                type="text"
                />
            <error-small :condition="duplicateName">
                {{__('Environment name is taken')}}
            </error-small>
            <error-small :condition="nameStartsWithNumber">
                {{__('Environment names cannot begin with a number')}}
            </error-small>
        </gl-form-group>

        <gl-form-group
            label="Cloud Provider"
            class="col-md-4 align_left"
            >
            <div class="dropdown-parent">
                <gl-dropdown data-testid="cloud-provider-dropdown">
                    <template #button-text>
                        <div style="display: flex; align-items: center;"> <detect-icon class="mr-2" :type="selectedCloudProvider" no-default/>{{selectedCloudProvider || __('Select')}} </div>
                    </template>
                    <gl-dropdown-item :data-testid="`env-option-${SHORT_NAMES[env]}`" :key="env" v-for="env in environmentsList" @click="() => selectedCloudProvider = env">
                        <div style="display: flex; align-items: center;"> <detect-icon class="mr-2" :type="env"/><div style="white-space: pre">{{env}}</div> </div>
                    </gl-dropdown-item>
                </gl-dropdown>
            </div>
        </gl-form-group>
        <form class="d-none" ref="form" method="POST" :action="action">
            <input name="authenticity_token" :value="token">
            <input name="environment[name]" :value="slugify(environmentName)">
            <input name="provider" :value="SHORT_NAMES[selectedCloudProvider]">
        </form>
    </div>
</template>
<style scoped>

.dropdown-parent >>> ul { width: unset; }
</style>
