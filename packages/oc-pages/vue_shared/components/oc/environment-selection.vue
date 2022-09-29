<script>
import {GlDropdown, GlDropdownItem, GlDropdownDivider} from '@gitlab/ui'
import {ErrorSmall, DetectIcon} from 'oc_vue_shared/oc-components'
import {mapGetters} from 'vuex'
export default {
    name: 'EnvironmentSelection',
    props: {
        provider: String,
        error: String,
        value: Object,
        environmentCreation: Boolean,
    },
    components: {
        GlDropdown,
        GlDropdownItem,
        GlDropdownDivider,
        ErrorSmall,
        DetectIcon,
    },
    computed: {
        ...mapGetters([ 'lookupEnvironment', 'getMatchingEnvironments', 'getAdditionalMatchingEnvironments', 'getHomeProjectPath' ]),
        matchingEnvironments() {
            return this.getMatchingEnvironments(this.provider).filter(env => env._dashboard == this.getHomeProjectPath)
        },
        externalEnvironments() {
            return this.getMatchingEnvironments(this.provider).filter(env => env._dashboard != this.getHomeProjectPath)
        },
        env() {
            if(typeof this.value == 'string') {
                return this.lookupEnvironment(this.value || this.defaultEnvironmentName)
            }
            return this.value
        }
    }
}

</script>
<template>
    <div class="dropdown-parent">
        <gl-dropdown v-if="environmentCreation || matchingEnvironments.length > 0" data-testid="deployment-environment-select" ref="dropdown">
            <template #button-text>
                <span class="d-flex" style="line-height: 1"><detect-icon v-if="value" class="mr-2" no-default :env="value"/>{{(env && env.name) || __("Select")}}</span>
            </template>

            <div v-if="matchingEnvironments.length + this.externalEnvironments.length > 0">
                <gl-dropdown-item :data-testid="`deployment-environment-selection-${env.name}`" v-for="env in matchingEnvironments" @click="$emit('input', env)" :key="env.name">
                    <div class="d-flex align-items-center"><detect-icon class="mr-2" :env="env" />{{ env.name }}</div>
                </gl-dropdown-item>
                <gl-dropdown-item :data-testid="`deployment-environment-selection-${env._dashboard}/${env.name}`" v-for="env in externalEnvironments" @click="$emit('input', env)" :key="env._dashboard + '/' + env.name">
                    <div class="d-flex align-items-center"><detect-icon class="mr-2" :env="env" />{{ env._dashboard }} <br> {{ env.name }}</div>
                </gl-dropdown-item>

                <gl-dropdown-divider v-if="environmentCreation"/>
            </div>
            <gl-dropdown-item class="disabled" v-if="environmentCreation" @click="$emit('createNewEnvironment')"><div style="white-space: pre">{{ __("Create new environment") }}</div></gl-dropdown-item>
        </gl-dropdown>
        <div v-else>No environments are available.</div>
        <error-small :message="error"/>
    </div>
</template>
