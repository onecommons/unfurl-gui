<script>
import { GlTabs, GlIcon, GlButton } from '@gitlab/ui';
import {DetectIcon, OcPropertiesList} from 'oc_vue_shared/oc-components'

// webpack gets confused with these two
import OcTab from 'oc_vue_shared/components/oc/oc-tab.vue'
import IncrementalDeploymentSwitch from 'oc_vue_shared/components/oc/incremental-deployment-switch.vue'
//

import OcInputs from './oc_inputs.vue'
import { bus } from 'oc_vue_shared/bus';
import { __ } from '~/locale';
import commonMethods from '../mixins/commonMethods';
import { mapGetters, mapActions } from 'vuex'
import Dependency from './dependency.vue'
import {getCustomInputComponent} from './oc_inputs'

export default {
    name: 'OcList',
    components: {
        GlTabs,
        OcTab,
        OcPropertiesList,
        OcInputs,
        Dependency,
        IncrementalDeploymentSwitch
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
        renderInputTabs: {
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
            'resolveResourceTypeFromAny',
            'resolveResourceTemplate',
            'cardStatus',
            'lookupEnvironmentVariable',
            'cardCanIncrementalDeploy',
            'getDeployments', 'getDeploymentDictionary'
        ]),
        hasRequirementsSetter() {
            return Array.isArray(this.$store._actions.setRequirementSelected)
        },
        // TODO reuse code between attributes and properties
        properties() {
            let properties = this._card.properties
            if(!properties && this._card.template) {
                if(typeof this._card.template == 'string') {
                    properties = this.resolveResourceTemplate(this._card.template)?.properties
                } else {
                    properties = this._card.template?.properties
                }
            } else if(!properties) { console.warn('Something has gone wrong here') }

            if(!properties) {
                properties = []
            }


            const titleMap = {}
            const sensitiveMap = {}
            const resourceType = this.resolveResourceTypeFromAny(this._card.type)
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
              value = value?.get_env? this.lookupEnvironmentVariable(value.get_env): value
              return {...property, name, value, sensitive}
            })

            if(this.cardCanIncrementalDeploy(this.card)) {
                properties.push({
                    name: 'Incremental_Deploy',
                    value: this.card
                })
            }

            return properties
        },
        attributes() {
            let attributes = [].concat(this._card.attributes || [], this._card.computedProperties || [])
            const titleMap = {}
            const sensitiveMap = {}
            const resourceType = this.resolveResourceTypeFromAny(this._card.type)

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
                if(this._card.status != 5) {
                    outboundLink = consoleURL.value,
                    outboundLinkText = `View ${this._card.title}`
                }

                attributes.unshift({
                    name: 'Status',
                    status: this._card.status,
                    state: this._card.state,
                    outboundLink,
                    outboundLinkText
                })
            }
            attributes = attributes.map(attribute => {
              const name = titleMap[attribute.name] || attribute.name
              const sensitive = sensitiveMap[attribute.name]
              let value = attribute.value
              value = value?.get_env? this.lookupEnvironmentVariable(value.get_env): value
              return {...attribute, name, value, sensitive}
            })

            if(this.cardCanIncrementalDeploy(this.card) && this._readonly) {
                attributes.push({
                    name: 'Incremental_Deploy',
                    value: this.card
                })
            }

            //attributes = attributes.map(attribute => ({...attribute, name: titleMap[attribute.name] || attribute.name}))
            return attributes
        },
        propertiesStyle() {
            if(this._card.dependentName) {
                return {width: 'max(75%, 400px)'}
            }
            return {}
        },
        shouldRenderOutputs() {
            return this.renderOutputs && this._card.outputs?.length
        },
        shouldRenderInputs() {
            return this.renderInputs && this.properties.length
        },
        shouldRenderAttributes() {
            return (
                // TODO fix these names
                this.renderInputs && 
                this.attributes.length
            )
        },
        requirements() {
            try {
                const requirements = this.getDisplayableDependenciesByCard(this._card.name).filter(pairing => (pairing.dependency?.constraint?.min || 0) > 0)
                return requirements
            } catch(e) {
                // catch for imported resources
                return []
            }
        },
        extras() {
            try {
                const extras = this.getDisplayableDependenciesByCard(this._card.name).filter(pairing => (pairing.dependency?.constraint?.min || 0) == 0)
                return extras
            } catch(e) {
                // catch for imported resources
                return []
            }
        },
        shouldRenderRequirements() { return this.requirements?.length },
        shouldRenderExtras() {return this.extras?.length},
        shouldRenderTabs() {
            return this.shouldRenderRequirements || (this.shouldRenderInputs && !this.customInputComponent) || this.shouldRenderExtras || this.shouldRenderAttributes || this.shouldRenderOutputs
        },
        _readonly() {
            return this.card.name.startsWith('__') || this.readonly || this.card.readonly
        },
        customInputComponent() {
            return !this._readonly && getCustomInputComponent(this._card.type)
        },
        cardType() {
            return this.resolveResourceTypeFromAny(this._card.type)
        },
        inputTabs() {
            if(!this.renderInputTabs || this._readonly) return []
            const result = []
            for(const [name, value] of Object.entries(this.cardType.inputsSchema.properties)) {
                if(value.tab_title) {
                    const count = Object.keys(value.properties).filter(key => key != '$toscatype').length
                    result.push({name, tab_title: value.tab_title, value, count})
                }
            }
            return result
        },
        importedResource() {
            if(!this.card?.imported) return null
            const [deploymentName, resourceName] = this.card.imported.split(':')
            const deployment = this.getDeployments.find(dep => dep.name == deploymentName)
            const dict = this.getDeploymentDictionary(deployment.name, deployment._environment)
            const resource = dict['Resource'][resourceName]

            // resolve the template here, since it's not in our other dictionary
            return {...resource, template: dict['ResourceTemplate'][resource.template]}
        },

        _card() {
            if(this.importedResource) {
                return {...this.card, ...this.importedResource}
            }
            return this.card
        }
    },
}
</script>
<template>
    <div>
        <component :is="customInputComponent" v-if="customInputComponent" :card="_card"/>
        <gl-tabs v-if="shouldRenderTabs" class="">
            <oc-tab v-if="shouldRenderRequirements" :title-testid="`tab-requirements-${_card.name}`" title="Components" :titleCount="requirements.length">
                <div class="row-fluid">
                    <div class="ci-table" role="grid">
                        <dependency :card="requirement.card" :readonly="_readonly" :display-status="displayStatus" :display-validation="displayValidation" :dependency="requirement.dependency" v-for="requirement in requirements" :key="requirement.dependency.name + '-template'"/>
                    </div>
                </div>
            </oc-tab>
            <oc-tab v-if="shouldRenderInputs && !customInputComponent" title="Inputs" :title-testid="`tab-inputs-${_card.name}`" :titleCount="properties.length">
                <oc-properties-list v-if="_readonly" :container-style="propertiesStyle" :properties="properties">
                    <template #Incremental_Deploy> <incremental-deployment-switch :card="_card" /> </template>
                </oc-properties-list>

                <oc-inputs v-else :card="_card" />
            </oc-tab>
            <oc-tab :key="tab.tab_title" :titleCount="tab.count" :title="tab.tab_title" v-for="tab in inputTabs">
                <oc-inputs :card="_card" :tab="tab.tab_title"/>
            </oc-tab>
            <oc-tab v-if="shouldRenderAttributes" title="Attributes" :titleCount="attributes.length">
                <oc-properties-list :container-style="propertiesStyle" :properties="attributes">
                    <template #Incremental_Deploy> <incremental-deployment-switch :card="card" /> </template>
                </oc-properties-list>
            </oc-tab>
            <oc-tab v-if="shouldRenderOutputs" title="Outputs" :titleCount="_card.outputs.length">
                <oc-properties-list :container-style="propertiesStyle" :card="_card" property="outputs">
                    <!-- not sure this template would ever be reached -->
                    <template #Incremental_Deploy> <incremental-deployment-switch :card="card" /> </template>
                </oc-properties-list>
            </oc-tab>
            <oc-tab v-if="shouldRenderExtras" title="Extras" :title-testid="`tab-extras-${_card.name}`" :titleCount="extras.length">
                <div class="row-fluid">
                    <div class="ci-table" role="grid">
                        <dependency :card="extra.card" :readonly="_readonly" :display-status="displayStatus" :display-validation="displayValidation" :dependency="extra.dependency" v-for="extra in extras" :key="extra.dependency.name + '-template'"/>
                    </div>
                </div>
            </oc-tab>
        </gl-tabs>
    </div>
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
