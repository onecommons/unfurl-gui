<script>
import { __ } from '~/locale';
import {GlFormGroup, GlFormInput, GlDropdown, GlDropdownItem} from '@gitlab/ui'
import LogosCloud from './shared/logos_cloud.vue'
export default {
    components: {
        GlFormGroup,
        GlFormInput,
        GlDropdown,
        GlDropdownItem,
        LogosCloud,
    },
    data() {
        return {
            environmentName: '',
            cloudProvider: __('Select'),
            environmentsList: [
                'Google Cloud Platform',
                'Amazon Web Services'
            ]
        }
    },
    watch: {
        environmentName() {
            this.$emit('environmentNameChange', this.environmentName)
        },
        cloudProvider() {
            this.$emit('cloudProviderChange', this.cloudProvider)
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
            <gl-dropdown
                :text="cloudProvider"
                >
                <gl-dropdown-item :key="env" v-for="env in environmentsList" @click="() => cloudProvider = env">
                    <span style="display: flex; align-items: center; justify-content: space-between;">
                        <logos-cloud :small="true" :cloud="env"/>{{env}}
                    </span>
                </gl-dropdown-item>
            </gl-dropdown>
        </gl-form-group>
    </div>
</template>
