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
            default: null
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
            'resolveResourceType',
            'cardStatus',
            'lookupVariableByEnvironment'
        ]),
        hasRequirementsSetter() {
            return Array.isArray(this.$store._actions.setRequirementSelected)
        },
        // TODO reuse code between attributes and properties
        properties() {
            let properties = this.card.properties
            const titleMap = {}
            const sensitiveMap = {}
            const resourceType = this.resolveResourceType(this.card.type)
            Object.entries(resourceType?.inputsSchema?.properties || {})
                .forEach(([name, value]) => {
                    titleMap[name] = value?.title
                })
            Object.entries(resourceType?.inputsSchema?.properties || {})
                .forEach(([name, value]) => {
                    sensitiveMap[name] = value.sensitive
              })

            properties = properties.map(property => {
              const name = titleMap[property.name] || property.name
              const sensitive = sensitiveMap[property.name]
              let value = property.value
              value = value?.get_env? this.lookupVariableByEnvironment(value.get_env, this.getCurrentEnvironment): value
              return {...property, name, value, sensitive}
            })

            return properties
        },
        attributes() {
            let attributes = [].concat(this.card.attributes || [], this.card.computedProperties || [])
            const titleMap = {}
            const sensitiveMap = {}
            const resourceType = this.resolveResourceType(this.card.type)

            Object.entries(resourceType?.inputsSchema?.properties || {})
                .forEach(([name, value]) => {
                    titleMap[name] = value?.title
                })

            Object.entries(resourceType?.inputsSchema?.properties || {})
                .forEach(([name, value]) => {
                    sensitiveMap[name] = value.sensitive
              })

            Object.entries(resourceType?.outputsSchema?.properties || {})
                .forEach(([name, value]) => {
                    titleMap[name] = value?.title
                })

            Object.entries(resourceType?.computedPropertiesSchema?.properties || {})
                .forEach(([name, value]) => {
                    titleMap[name] = value?.title
                })

            Object.entries(resourceType?.outputsSchema?.properties || {})
                .forEach(([name, value]) => {
                    sensitiveMap[name] = value.sensitive
              })

            Object.entries(resourceType?.computedPropertiesSchema?.properties || {})
                .forEach(([name, value]) => {
                    sensitiveMap[name] = value.sensitive
              })

            const consoleURLIndex = attributes.findIndex(a => a.name == 'console_url')
            if(consoleURLIndex != -1) {
                const consoleURL = attributes[consoleURLIndex]
                attributes.splice(consoleURLIndex, 1)

                let outboundLink, outboundLinkText
                if(this.card.status != 5) {
                    outboundLink = consoleURL.value,
                    outboundLinkText = `View ${this.card.title}`
                }

                attributes.unshift({
                    name: 'Status',
                    status: this.card.status,
                    outboundLink,
                    outboundLinkText
                })
            }
            attributes = attributes.map(attribute => {
              const name = titleMap[attribute.name] || attribute.name
              const sensitive = sensitiveMap[attribute.name]
              let value = attribute.value
              value = value?.get_env? this.lookupVariableByEnvironment(value.get_env, this.getCurrentEnvironment): value
              return {...attribute, name, value, sensitive}
            })

            //attributes = attributes.map(attribute => ({...attribute, name: titleMap[attribute.name] || attribute.name}))
            return attributes
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
                this.attributes.length
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
        _readonly() {
            return this.readonly ?? this.card.name.startsWith('__')
        },
    },
}
</script>
<template>
    <gl-tabs v-if="shouldRenderTabs" class="">
      <oc-tab v-if="shouldRenderRequirements" :title-testid="`tab-requirements-${card.name}`" title="Components" :titleCount="requirements.length">
            <div class="row-fluid">
                <div class="ci-table" role="grid">
                    <dependency :card="requirement.card" :readonly="_readonly" :display-status="displayStatus" :display-validation="displayValidation" :dependency="requirement.dependency" v-for="requirement in requirements" :key="requirement.dependency.name + '-template'"/>
                </div>
            </div>
        </oc-tab>
        <oc-tab v-if="shouldRenderInputs" title="Inputs" :title-testid="`tab-inputs-${card.name}`" :titleCount="properties.length">
            <oc-properties-list v-if="_readonly" :container-style="propertiesStyle" :properties="properties" />
            <oc-inputs v-else :card="card" :main-inputs="getCardProperties(card)" />
        </oc-tab>
        <oc-tab v-if="shouldRenderAttributes" title="Attributes" :titleCount="attributes.length">
            <oc-properties-list :container-style="propertiesStyle" :properties="attributes" />
        </oc-tab>
        <oc-tab v-if="shouldRenderOutputs" title="Outputs" :titleCount="card.outputs.length">
            <oc-properties-list :container-style="propertiesStyle" :card="card" property="outputs" />
        </oc-tab>
        <oc-tab v-if="shouldRenderExtras" title="Extras" :title-testid="`tab-extras-${card.name}`" :titleCount="extras.length">
            <div class="row-fluid">
                <div class="ci-table" role="grid">
                    <dependency :card="extra.card" :readonly="_readonly" :display-status="displayStatus" :display-validation="displayValidation" :dependency="extra.dependency" v-for="extra in extras" :key="extra.dependency.name + '-template'"/>
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
    div.ci-table {
        grid-template-columns: repeat(1, auto);
        grid-auto-rows: unset;
    }
}
/**/


.oc_requirements_actions {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.ci-table {
    display: grid;
    grid-template-columns: repeat(3, auto);
    grid-auto-rows: 4em;
}
</style>
