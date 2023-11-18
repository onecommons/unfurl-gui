<script>
import { GlTabs } from '@gitlab/ui';

import OcInputs from './oc_inputs.vue'
import { __ } from '~/locale';
import commonMethods from '../mixins/commonMethods';
import { mapGetters } from 'vuex'
import Dependency from './dependency.vue'
import {getCustomInputComponent} from './oc_inputs'

export default {
    name: 'OcList',
    components: {
        GlTabs,
        OcInputs,
        Dependency,
    },

    mixins: [commonMethods],

    props: {
        tabsTitle: {
            type: String,
            required: false,
            default: __('List')
        },

        card: {
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
            inputsLength: null,
        }
    },

    methods: {
        requirementKey(requirement) {
            return `${requirement.card.dependentName}.${requirement.card.dependentRequirement}.${requirement.dependency.name}`
        },
        formatPropertiesList(schema, items) {
            const result = items
                .filter(item => schema[item.name]?.visibility != 'hidden')
                .map(item => {
                    const name = schema[item.name]?.title || item.name
                    const sensitive = schema[item.name]?.sensitive ?? false
                    let value = item.value

                    try {
                        if(this._readonly) value = schema[item.name]['display-value'] || value
                    } catch(e) {}

                    value = value?.get_env? this.lookupEnvironmentVariable(value.get_env): value
                    return {...item, name, value, sensitive}
                })

            if(this.cardCanIncrementalDeploy(this.card) && this._readonly) {
                result.push({
                    name: 'Incremental_Deploy',
                    value: this.card
                })
            }

            return result
        }

    },

    computed: {
        ...mapGetters([
            'getCurrentEnvironment',
            'getValidEnvironmentConnections',
            'cardDependenciesAreValid',
            'getDisplayableDependenciesByCard',
            'getCardProperties',
            'resolveResourceTypeFromAny',
            'resolveResourceTemplate',
            'cardStatus',
            'lookupEnvironmentVariable',
            'cardCanIncrementalDeploy',
            'getDeployments', 'getDeploymentDictionary',
            'getDeployment',
            'resourceTemplateInputsSchema',
            'getCurrentContext'
        ]),
        hasRequirementsSetter() {
            return Array.isArray(this.$store._actions.setRequirementSelected)
        },
        // TODO reuse code between attributes and properties
        properties() {
            let properties = this._card.imported? null: this._card.properties
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

            const schema = this.inputsSchema?.properties || {}

            return this.formatPropertiesList(schema, properties)
        },
        attributes() {
            let attributes = [].concat(this._card.attributes || [], this._card.computedProperties || [])
            const resourceType = this.resolveResourceTypeFromAny(this._card.type)

            const schema = {
                ...this.inputsSchema?.properties,
                ...resourceType.outputsSchema?.properties,
                ...resourceType.computedPropertiesSchema?.properties
            }

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

            return this.formatPropertiesList(schema, attributes)
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
                !this.customInputComponent &&
                this.renderInputs &&
                this.attributes.length
            )
        },
        requirements() {
            try {
                let requirements = this.getDisplayableDependenciesByCard(this._card.name).filter(pairing => (pairing.dependency?.constraint?.min || 0) > 0)
                if(this._readonly) {
                    requirements = requirements.filter(pairing => !!pairing.dependency?.match)
                }
                return requirements
            } catch(e) {
                // catch for imported resources
                return []
            }
        },
        extras() {
            try {
                let extras = this.getDisplayableDependenciesByCard(this._card.name).filter(pairing => (pairing.dependency?.constraint?.min || 0) == 0)
                if(this._readonly) {
                    extras = extras.filter(pairing => !!pairing.dependency?.match)
                }
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
            return (!this._readonly || this.getCurrentContext === false) && getCustomInputComponent(this._card.type)
        },
        inputsSchema() {
            return this.resourceTemplateInputsSchema(this._card)
        },
        inputTabs() {
            if(!this.renderInputTabs || this._readonly) return []
            const result = []
            for(const [name, value] of Object.entries(this.inputsSchema.properties)) {
                if(value.tab_title) {
                    const count = Object.keys(value.properties || {}).filter(key => key != '$toscatype').length
                    result.push({name, tab_title: value.tab_title, value, count})
                }
            }
            return result
        },
        importedResource() {
            if(!this.card?.imported) return null
            const [deploymentName, resourceName] = this.card.imported.split(':', 2)
            const deployment = deploymentName?
                this.getDeployments.find(dep => dep.name == deploymentName) :
                this.getDeployment

            if(!deployment) return null

            const dict = this.getDeploymentDictionary(deployment.name, deployment._environment)
            const resource = dict['Resource'][resourceName]

            // resolve the template here, since it's not in our other dictionary
            return {...resource, template: dict['ResourceTemplate'][resource.template]}
        },

        _card() {
            if(this.importedResource) {
                return {...this.card, ...this.importedResource, imported: this.card.imported}
            }
            return this.card
        },

        inputsTitleCount() {
          return this.inputsLength ?? this.properties.length
        }
    },
}
</script>
<template>
    <div>
        <component :is="customInputComponent" :readonly="_readonly" v-if="customInputComponent" :card="_card"/>
        <gl-tabs v-if="shouldRenderTabs" class="">
            <oc-tab v-if="shouldRenderRequirements" :title-testid="`tab-requirements-${_card.name}`" title="Components" :titleCount="requirements.length">
                <div class="row-fluid">
                    <div class="ci-table" role="grid"> <dependency :card="requirement.card" :readonly="_readonly" :display-status="displayStatus" :display-validation="displayValidation" :dependency="requirement.dependency" v-for="requirement in requirements" :key="requirementKey(requirement)"/>
                    </div>
                </div>
            </oc-tab>
            <oc-tab v-if="shouldRenderInputs && !customInputComponent" title="Inputs" :title-testid="`tab-inputs-${_card.name}`" :titleCount="inputsTitleCount">
                <oc-properties-list v-if="_readonly" :container-style="propertiesStyle" :properties="properties">
                    <template #Incremental_Deploy> <oc-incremental-deployment-switch :card="_card" /> </template>
                </oc-properties-list>

                <oc-inputs @setInputLength="i => inputsLength = i" ref="inputs" v-else :card="_card" />
            </oc-tab>
            <oc-tab :key="tab.tab_title" no-count-zero :titleCount="tab.count" :title="tab.tab_title" :title-testid="`tab-${tab.name}-${_card.name}`" v-for="tab in inputTabs">
                <oc-inputs :card="_card" @setInputLength="len => tab.count = len" :property-path="[tab.name]"/>
            </oc-tab>
            <oc-tab v-if="shouldRenderAttributes" title="Attributes" :titleCount="attributes.length">
                <oc-properties-list :container-style="propertiesStyle" :properties="attributes">
                    <template #Incremental_Deploy> <oc-incremental-deployment-switch :card="card" /> </template>
                </oc-properties-list>
            </oc-tab>
            <oc-tab v-if="shouldRenderOutputs" title="Outputs" :titleCount="_card.outputs.length">
                <oc-properties-list :container-style="propertiesStyle" :card="_card" property="outputs">
                    <!-- not sure this template would ever be reached -->
                    <template #Incremental_Deploy> <oc-incremental-deployment-switch :card="card" /> </template>
                </oc-properties-list>
            </oc-tab>
            <oc-tab v-if="shouldRenderExtras" title="Extras" :title-testid="`tab-extras-${_card.name}`" :titleCount="extras.length">
                <div class="row-fluid">
                    <div class="ci-table" role="grid">
                        <dependency :card="extra.card" :readonly="_readonly" :display-status="displayStatus" :display-validation="displayValidation" :dependency="extra.dependency" v-for="extra in extras" :key="requirementKey(extra)"/>
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
