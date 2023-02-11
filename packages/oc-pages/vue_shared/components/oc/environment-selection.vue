<script>
import {GlDropdown, GlDropdownItem, GlDropdownDivider} from '@gitlab/ui'
import {ErrorSmall, DetectIcon} from 'oc/vue_shared/components/oc'
import {mapGetters} from 'vuex'
import {fetchAvailableProviderDashboards} from 'oc/vue_shared/client_utils/environments'

const DEPLOY_INTO_ENV_MIN_ACCESS = 30

export default {
    name: 'EnvironmentSelection',
    props: {
        provider: String,
        error: String,
        value: Object,
        environmentCreation: Boolean,
    },
    data() {
        return {
            additionalDashboards: []
        }
    },
    components: {
        GlDropdown,
        GlDropdownItem,
        GlDropdownDivider,
        ErrorSmall,
        DetectIcon,
    },
    watch: {
        env: {
            immediate: true,
            handler(env) {
                this.$emit('input', env)
            }
        }
    },
    computed: {
        ...mapGetters([ 'lookupEnvironment', 'getMatchingEnvironments', 'getHomeProjectPath' ]),
        matchingEnvironments() {
            return this.getMatchingEnvironments(this.provider).filter(env => env._dashboard == this.getHomeProjectPath)
        },
        externalEnvironments() {
            return (this.additionalDashboards || [])
                .map(
                    dash => Object.entries(dash.providersByEnvironment)
                        .filter(([env, providers]) => providers && providers.includes(this.provider))
                        .map(([env, _]) => ({name: env, _dashboard: dash.fullPath, type: dash.primaryProviderFor(env)}))
                ).flat()
        },
        env() {
            let result
            if(typeof this.value == 'string') {
                result = this.lookupEnvironment(this.value || this.defaultEnvironmentName)
            } else {
                result = this.value
            }

            if(result?.name && this.matchingEnvironments.concat(this.externalEnvironments).some(env => env.name == result.name)) {
                return result
            }

            return null
        }
    },
    async beforeMount() {
        this.additionalDashboards = (await fetchAvailableProviderDashboards(DEPLOY_INTO_ENV_MIN_ACCESS))
            .filter(dash => dash.fullPath != this.getHomeProjectPath)
    }
}

</script>
<template>
    <div class="dropdown-parent">
        <gl-dropdown v-if="environmentCreation || matchingEnvironments.length > 0" data-testid="deployment-environment-select" ref="dropdown">
            <template #button-text>
                <span class="d-flex" style="line-height: 1">
                    <!-- detect icon for thin copy of env -->
                    <detect-icon v-if="env && env.type" class="mr-2" no-default :type="env.type" />
                    <!-- detect icon loaded env -->
                    <detect-icon v-else-if="env" class="mr-2" no-default :env="env" />

                    {{(env && env.name) || __("Select")}}
                </span>
            </template>

            <div v-if="matchingEnvironments.length + externalEnvironments.length > 0">
                <gl-dropdown-item :data-testid="`deployment-environment-selection-${env.name}`" v-for="env in matchingEnvironments" @click="$emit('input', env)" :key="env.name">
                    <div class="d-flex align-items-center"><detect-icon class="mr-2" :env="env" />{{ env.name }}</div>
                </gl-dropdown-item>
                <gl-dropdown-item :data-testid="`deployment-environment-selection-${env._dashboard}/${env.name}`" v-for="env in externalEnvironments" @click="$emit('input', env)" :key="env._dashboard + '/' + env.name">
                    <div class="d-flex align-items-center"><detect-icon class="mr-2" :type="env.type" />{{ env._dashboard }} <br> {{ env.name }}</div>
                </gl-dropdown-item>

                <gl-dropdown-divider v-if="environmentCreation" />
            </div>
            <gl-dropdown-item class="disabled" v-if="environmentCreation" @click="$emit('createNewEnvironment')">
                <div style="white-space: pre">{{ __("Create new environment") }}</div>
            </gl-dropdown-item>
        </gl-dropdown>
        <div v-else>No environments are available.</div>
        <error-small :message="error"/>
    </div>
</template>
