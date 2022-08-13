<script>
import axios from '~/lib/utils/axios_utils';
import { __ } from '~/locale';
import _ from 'lodash'
import { slugify, USER_HOME_PROJECT } from 'oc_vue_shared/util.mjs'
import {postGitlabEnvironmentForm, initUnfurlEnvironment} from 'oc_vue_shared/client_utils/environments'
import {GlFormGroup, GlFormInput, GlDropdown, GlDropdownItem, GlDropdownDivider, GlFormCheckbox} from '@gitlab/ui'
import {DetectIcon, ErrorSmall} from 'oc_vue_shared/oc-components'
import {lookupCloudProviderAlias} from 'oc_vue_shared/util.mjs'
import {token} from 'oc_vue_shared/compat.js'
import {mapGetters, mapActions} from 'vuex'


const LOCAL_DEV = 'Local Dev'

const CLUSTER_PROVIDER_NAMES = {
    'Google Cloud Platform': 'gcp',
    'Amazon Web Services': 'aws',
    'Digital Ocean': '',
    'Kubernetes': '',
    [LOCAL_DEV]: ''
}

export default {
    components: {
        GlFormGroup,
        GlFormInput,
        GlDropdown,
        GlDropdownItem,
        GlDropdownDivider,
        GlFormCheckbox,
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
            CLUSTER_PROVIDER_NAMES,
            token,
            nameStartsWithNumber: false,
            duplicateName: false,
            enableShowExistingProviders: true,
        }
    },
    computed: {
        ...mapGetters(['lookupEnvironment', 'getHomeProjectPath', 'availableProviders']),
        environmentsList() {
            const result = Object.keys(CLUSTER_PROVIDER_NAMES)

            if(this.allowAny) return result

            const cloudProviderName = lookupCloudProviderAlias(this.cloudProvider)

            //local dev not currently supported on other platforms
            //if(cloudProviderName) {
                return result.filter(envName => {
                    return lookupCloudProviderAlias(this.CLUSTER_PROVIDER_NAMES[envName]) == cloudProviderName
                })
            //}

            return result
        },
        action() {
            return `${window.origin}/${this.getHomeProjectPath}/-/environments`
        },
        filteredAvailableProviders() {
            return this.availableProviders.filter(provider => {
                if(provider.source == 'instance') return true
                if([lookupCloudProviderAlias('gcp'), lookupCloudProviderAlias('aws')].includes(provider.template.type)) return false

                return true
            })
        },
        showExistingProviders() {
            return this.enableShowExistingProviders && this.availableProviders?.length
        },
        currentType() {
            return this.selectedCloudProvider?.template?.type || this.selectedCloudProvider
        },
        currentText() {
            return this.displayProvider(this.selectedCloudProvider) || this.selectedCloudProvider || __('Select')
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
        ...mapActions(['environmentFromProvider']),
        async createLocalDevEnvironment() {
          // this is an ugly hack, refactor to just submit the form
          sessionStorage['environmentFormEntries'] = JSON.stringify(Array.from((new FormData(this.$refs.form)).entries()))
          sessionStorage['environmentFormAction'] = this.action
          await postGitlabEnvironmentForm();
          const primary_provider = this.selectedCloudProvider != LOCAL_DEV ? {
              name: 'primary_provider', 
              type: lookupCloudProviderAlias(this.selectedCloudProvider),
              __typename: 'ResourceTemplate'
          } : undefined

          initUnfurlEnvironment(
            this.getHomeProjectPath,
            {
              name: slugify(this.environmentName),
              primary_provider
            }
          )
        },

        async beginEnvironmentCreation(_redirectTarget) {
            let redirectTarget = _redirectTarget || window.location.pathname + window.location.search
            // rails is settings params weird
            if (!redirectTarget.includes('?')) redirectTarget += '?'

            sessionStorage['cancelTo'] = window.location.href
            sessionStorage['environmentFormEntries'] = JSON.stringify(Array.from((new FormData(this.$refs.form)).entries()))
            sessionStorage['environmentFormAction'] = this.action

            if(typeof this.selectedCloudProvider != 'string') {
                sessionStorage['environmentFormEntries'] = JSON.stringify(Array.from((new FormData(this.$refs.form)).entries()))
                sessionStorage['environmentFormAction'] = this.action
                await postGitlabEnvironmentForm();
                await this.environmentFromProvider({newEnvironmentName: this.environmentName, provider: this.selectedCloudProvider})
                window.location.href = redirectTarget;
            } else if(! CLUSTER_PROVIDER_NAMES[this.selectedCloudProvider]) {
              await this.createLocalDevEnvironment()
              window.location.href = redirectTarget;
            } else {
              const url = `${window.origin}/${this.getHomeProjectPath}/-/environments/new_redirect?new_env_redirect_url=${encodeURIComponent(redirectTarget)}`
              sessionStorage['expect_cloud_provider_for'] = slugify(this.environmentName)
              await axios.get(url); // set redirect

              window.location.href = `/${this.getHomeProjectPath}/-/clusters/new?env=${slugify(this.environmentName)}&provider=${CLUSTER_PROVIDER_NAMES[this.selectedCloudProvider]}`
            }
        },
        displayProvider(provider) {
            return provider?.template?.name == 'primary_provider' && provider?.source == 'connection'? provider?.environment?.name: provider?.template?.name
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
            class="col-md-8 align_left"
            >
                <div class="dropdown-parent">
                    <gl-dropdown data-testid="cloud-provider-dropdown">
                        <template #header>
                            <div>
                                <gl-form-checkbox v-model="enableShowExistingProviders" style="margin: 0 1rem;">Show existing providers</gl-form-checkbox>
                                <gl-dropdown-divider />
                            </div>
                        </template>
                        <template #button-text>
                            <div style="display: flex; align-items: center;"> <detect-icon class="mr-2" :type="currentType" no-default/>{{currentText}} </div>
                        </template>
                        <gl-dropdown-item :data-testid="`env-option-${CLUSTER_PROVIDER_NAMES[env] || env.replace(/\s+/g, '')}`" :key="env" v-for="env in environmentsList" @click="selectedCloudProvider = env">
                            <div style="display: flex; align-items: center;"> <detect-icon class="mr-2" :type="env"/><div style="white-space: pre">{{env}}</div> </div>
                        </gl-dropdown-item>
                        <div v-if="showExistingProviders">
                            <gl-dropdown-divider />
                            <gl-dropdown-item @click="selectedCloudProvider = provider" :key="`${provider.template.name}.${provider.environment.name}`" v-for="provider in filteredAvailableProviders">
                                <div style="display: flex; align-items: center;"> 
                                    <detect-icon class="mr-2" :type="provider.template.type"/>
                                    <div style="white-space: pre">{{displayProvider(provider)}}</div>
                                </div>
                            </gl-dropdown-item>
                        </div>
                    </gl-dropdown>
                </div>
        </gl-form-group>
        <form class="d-none" ref="form" method="POST" :action="action">
            <input name="authenticity_token" :value="token">
            <input name="environment[name]" :value="slugify(environmentName)">
            <input name="provider" :value="CLUSTER_PROVIDER_NAMES[selectedCloudProvider]">
        </form>
    </div>
</template>
<style scoped>

.dropdown-parent >>> ul { width: unset; }
</style>
