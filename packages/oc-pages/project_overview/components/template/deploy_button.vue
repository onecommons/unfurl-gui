<script>
import { mapGetters } from 'vuex'

import { Tooltip as ElTooltip } from 'element-ui'
import { GlButton, GlButtonGroup, GlDropdown, GlDropdownItem } from '@gitlab/ui';
import ErrorSmall from 'oc/vue_shared/components/oc/ErrorSmall.vue'

export default {
    name: 'DeployButton',
    components: {
        ElTooltip,
        ErrorSmall,
        GlButton, GlButtonGroup, GlDropdown, GlDropdownItem
    },
    props: {
        deployStatus: String
    },
    methods: {
        triggerDeploy() {
            this.$emit('triggerDeploy')
        },
        triggerLocalDeploy() {
            this.$emit('triggerLocalDeploy')
        }
    },
    computed: {
        ...mapGetters([
            'editingTorndown',
            'cardIsValid',
            'deployTooltip',
            'getPrimaryCard',
        ]),
        canDeploy() {
            return this.cardIsValid(this.getPrimaryCard)
        },
    }
}

</script>
<template>
    <el-tooltip :disabled="!deployTooltip">
        <template #content>
            <div>
                {{deployTooltip}}
            </div>
        </template>
        <div v-if="deployStatus != 'hidden' && !editingTorndown" class="d-flex flex-column position-relative">
            <gl-button-group class="deploy-button">
                <gl-button
                    :aria-label="__('Deploy')"
                    data-testid="deploy-button"
                    :title="!deployTooltip? 'Deploy': null"
                    type="button"
                    icon="upload"
                    class="deploy-action"
                    :disabled="deployStatus == 'disabled'"
                    @click.prevent="triggerDeploy"
                >
                    {{ __('Deploy') }}
                </gl-button>
                <gl-dropdown :disabled="deployStatus == 'disabled'" right>
                    <gl-dropdown-item @click="triggerLocalDeploy">
                        Deploy Locally
                    </gl-dropdown-item>

                </gl-dropdown>
            </gl-button-group>
            <error-small class="position-absolute" style="top: 2.25em; right: 0; width: 300px; text-align: right;" :condition="!canDeploy">
                <div class="d-flex align-items-center justify-content-end">
                    <span style="line-height: 1;">Deployment is incomplete</span><i style="font-size: 1.25em;" class="el-icon-info ml-1"/>
                </div>
            </error-small>

        </div>
    </el-tooltip>

</template>
<style scoped>
.deploy-button >>> .gl-button {
    margin: 0!important;
    padding: 8px 12px !important;
}
.deploy-button >>> svg {
    margin-left: 0!important;
}
</style>
