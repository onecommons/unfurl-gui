<script>
import { GlTabs, GlIcon, GlButton } from '@gitlab/ui';
import {DetectIcon, OcPropertiesList} from '../../../vue_shared/oc-components'
import OcTab from '../../../vue_shared/components/oc/oc-tab.vue'
import OcInputs from './oc_inputs.vue'
import { bus } from 'oc_vue_shared/bus';
import { __ } from '~/locale';
import commonMethods from '../mixins/commonMethods';
import { mapGetters, mapActions } from 'vuex'
import Dependency from './dependency.vue'

export default {
    name: 'OcList',
    components: {
        GlTabs,
        OcTab,
        OcPropertiesList,
        OcInputs,
        Dependency
    },

    mixins: [commonMethods],

    props: {
        validResourceTypesByRequirement: {
            type: Object,
            default: () => {}
        },
        tabsTitle: {
            type: String,
            required: false,
            default: __('List')
        },
        showTypeFirst: {
            type: Boolean,
            required: false,
            default: false
        },

        level: {
            type: Number,
            required: true,
        },

        titleKey: {
            type: String,
            required: false,
            default: null
        },

        card: {
            type: Object,
            required: true
        },
        cloud: {
            type: String,
            required: false,
        },
        deploymentTemplate: {
            type: Object,
            required: true
        },
        displayValidation: {
            type: Boolean,
            default: true,
        },
        displayStatus: {
            type: Boolean,
            default: false,
        },
        renderInputs: {
            type: Boolean,
            default: true
        },
        renderOutputs: {
            type: Boolean,
            default: true
        },
        readonly: {
            type: Boolean,
            default: false
        }
    },
    data() {
        return {
            resourceName: '',
        }
    },

    computed: {
        ...mapGetters([
            'getCurrentEnvironment',
            'getValidConnections',
            'cardDependenciesAreValid',
            'getDisplayableDependenciesByCard',
            'getCardProperties',
            'cardStatus',
        ]),
        hasRequirementsSetter() {
            return Array.isArray(this.$store._actions.setRequirementSelected)
        },
        propertiesStyle() {
            if(this.card.dependentName) {
                return {width: 'max(75%, 400px)'}
            }
            return {}
        },
        shouldRenderOutputs() {
            return this.renderOutputs && this.card.outputs?.length
        },
        shouldRenderInputs() {
            return this.renderInputs && this.card.properties?.length
        },
        shouldRenderAttributes() {
            return (
                !this.shouldRenderInputs &&
                this.renderInputs && 
                this.card.attributes?.length
            )
        },
        requirements() {
            const requirements = this.getDisplayableDependenciesByCard(this.card.name).filter(pairing => (pairing.dependency?.constraint?.min || 0) > 0)
            return requirements
        },
        extras() {
            const extras = this.getDisplayableDependenciesByCard(this.card.name).filter(pairing => (pairing.dependency?.constraint?.min || 0) == 0)
            return extras
        },
        shouldRenderRequirements() { return this.requirements?.length },
        shouldRenderExtras() {return this.extras?.length},
        shouldRenderTabs() {
            return this.shouldRenderRequirements || this.shouldRenderInputs || this.shouldRenderExtras || this.shouldRenderAttributes || this.shouldRenderOutputs
        },


    },
}
</script>
<template>
    <gl-tabs v-if="shouldRenderTabs" class="">
      <oc-tab v-if="shouldRenderRequirements" :title-testid="`tab-requirements-${card.name}`" title="Requirements" :titleCount="requirements.length">
            <div class="row-fluid">
                <div class="ci-table" role="grid">
                    <dependency :card="requirement.card" :readonly="readonly" :display-status="displayStatus" :display-validation="displayValidation" :dependency="requirement.dependency" :idx="idx" v-for="(requirement, idx) in requirements" :key="requirement.dependency.name + '-template'"/>
                </div>
            </div>
        </oc-tab>
        <oc-tab v-if="shouldRenderInputs" title="Inputs" :title-testid="`tab-inputs-${card.name}`" :titleCount="card.properties.length">
            <oc-properties-list v-if="readonly" :container-style="propertiesStyle" :card="card" property="properties"/>
            <oc-inputs v-else :card="card" :main-inputs="getCardProperties(card)" />
        </oc-tab>
        <oc-tab v-if="shouldRenderAttributes" title="Attributes" :titleCount="card.attributes.length">
            <oc-properties-list :container-style="propertiesStyle" :card="card" property="attributes" />
        </oc-tab>
        <oc-tab v-if="shouldRenderOutputs" title="Outputs" :titleCount="card.outputs.length">
            <oc-properties-list :container-style="propertiesStyle" :card="card" property="outputs" />
        </oc-tab>
        <oc-tab v-if="shouldRenderExtras" title="Extras" :titleCount="extras.length">
            <div class="row-fluid">
                <div class="ci-table" role="grid">
                    <dependency :card="extra.card" :readonly="readonly" :display-status="displayStatus" :display-validation="displayValidation" :dependency="extra.dependency" :idx="idx" v-for="(extra, idx) in extras" :key="extra.dependency.name + '-template'"/>
                </div>
            </div>
        </oc-tab>
    </gl-tabs>
</template>
<style scoped>
/* this is currently also defined elsewhere */

@media only screen and (max-width: 768px) {
    .oc_table_row {
        display: flex;
        flex-direction: column;
    }
}
/**/


.oc_requirements_actions {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
</style>
