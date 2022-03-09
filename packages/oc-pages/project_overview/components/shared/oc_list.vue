<script>
import { GlTabs, GlIcon, GlButton } from '@gitlab/ui';
import {DetectIcon, OcPropertiesList} from '../../../vue_shared/oc-components'
import OcTab from '../../../vue_shared/components/oc/oc-tab.vue'
import OcInputs from './oc_inputs.vue'
import { bus } from '../../bus';
import { __ } from '~/locale';
import commonMethods from '../mixins/commonMethods';
import { mapGetters, mapActions } from 'vuex'
import StatusIcon from '../../../vue_shared/components/oc/Status.vue'

export default {
    name: 'OcList',
    components: {
        GlTabs,
        OcTab,
        GlIcon,
        GlButton,
        StatusIcon,
        OcPropertiesList,
        OcInputs,
        DetectIcon
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
            DEFAULT_ACTION_LABEL: 'Add a new provider'
        }
    },

    computed: {
        ...mapGetters([
            'getCurrentEnvironment',
            'getValidResourceTypes',
            'getValidConnections',
            'requirementMatchIsValid',
            'resolveRequirementMatchTitle',
            'cardDependenciesAreValid',
            'getDisplayableDependencies',
            'getCardProperties',
            'cardStatus',
            'isMobileLayout',
            'resolveResourceType'
        ]),
        displayableDependencies() {
            const result = this.getDisplayableDependencies(this.card.name)
            return result

        },
        canConnectServices() {
            return this.$route.name != 'templatePage'
        },
        hasRequirementsSetter() {
            return Array.isArray(this.$store._actions.setRequirementSelected)
        },
        propertiesStyle() {
            if(this.card.dependentName) {
                return {width: 'max(75%, 400px)'}
            }
            return {}
        },
        shouldRenderDependencies() {
            return this.displayableDependencies && this.displayableDependencies.length > 0   
        },
        shouldRenderOutputs() {
            return this.renderOutputs && this.card.attributes
        },
        shouldRenderInputs() {
            return this.renderInputs && this.card.properties.length
        },
        shouldRenderTabs() {
            return this.shouldRenderDependencies || this.shouldRenderOutputs || this.shouldRenderInputs
        }

    },

    methods: {
        ...mapActions([
            'setRequirementSelected',
        ]),

        findElementToScroll({requirement}) {
            bus.$emit('moveToElement', {elId: requirement.match});
        },

        connectToResource(requirement) {
            if(this.hasRequirementsSetter) {
                this.setRequirementSelected({dependentName: this.card.name, dependentRequirement: requirement.name, requirement, titleKey: this.titleKey}); // TODO trying to make this redundant
            }
            bus.$emit('launchModalToConnect', {dependentName: this.card.name, dependentRequirement: requirement.name, requirement, action: 'connect'});
        },

        sendRequirement(requirement) {
            if(this.hasRequirementsSetter) {
                this.setRequirementSelected({requirement, titleKey: this.titleKey});  // TODO trying to make this redundant
            }
            
            bus.$emit('placeTempRequirement', {dependentName: this.card.name, dependentRequirement: requirement.name, requirement, action: 'create'});
        },

        //TODO add an option to add a new service
        openDeleteModal(index, action=__("Remove")) {
            const dependency = this.card.dependencies[index]
            //const card = this.resolveResourceTemplate(dependency.match)
            bus.$emit('deleteNode', {name: dependency.match, level: this.level, action, dependentRequirement: dependency.name, dependentName: this.card.name});
        },

        //TODO 
        getCurrentActionLabel(requirement) {
            //if(!requirement.completionStatus) return '';
            switch(requirement.completionStatus) {
              case 'connected': return __('Disconnect')
              case 'created': return __('Remove')
              default: return __(this.DEFAULT_ACTION_LABEL)
            }
            //return requirement.completionStatus === "connected" ? __('Disconnect') : __("Remove")
        },

        requirementSatisfied(requirement) {
            const result =  !!(requirement.constraint.min == 0 || requirement.status || this.requirementMatchIsValid(requirement))
            return result
        }

    }
}
</script>
<template>
    <gl-tabs v-if="shouldRenderTabs" class="">
        <oc-tab v-if="shouldRenderDependencies" title="Dependencies" :titleCount="displayableDependencies.length">
            <!--template slot="title">
                <span>{{ tabsTitle }}</span>
                <gl-icon
                    v-if="displayValidation"
                    :size="14"
                    :class="{
                        'icon-green': cardDependenciesAreValid(card),
                        'icon-red': !cardDependenciesAreValid(card),
                        'gl-ml-4 gl-mt-1': true
                    }"
                    :name="cardDependenciesAreValid(card) ? 'check-circle-filled' : 'warning-solid'"
                    />
            </template-->
            <!-- TODO move this into a dpeendencies table component -->
            <div class="row-fluid">
                <div class="ci-table" role="grid">
                    <div
                        v-for="(requirement, idx) in displayableDependencies"
                        :key="requirement.name + '-template'"
                        class="gl-responsive-table-row oc_table_row">
                        <div
                            class="table-section oc-table-section section-wrap text-truncate section-40 align_left justify-content-between">
                            <div>
                                <detect-icon :size="16" class="gl-mr-2 icon-gray" :type="resolveResourceType(requirement.constraint.resourceType)" />
                                <span class="text-break-word title" style="font-weight: bold; color: #353545">{{ requirement.name }}</span>
                                <div class="oc_requirement_description gl-mb-2">
                                    {{ requirement.description}}
                                </div>
                            </div>
                            <div v-if="isMobileLayout" class="ml-2 mr-2">
                                <gl-icon
                                    v-if="displayValidation"
                                    :size="14"
                                    :class="{
                                            'icon-green': requirementSatisfied(requirement),
                                            'icon-red': !requirementSatisfied(requirement),
                                            }"
                                    :name="requirementSatisfied(requirement) ? 'check-circle-filled' : 'warning-solid'"
                                    />
                                <span v-if="requirementMatchIsValid(requirement)" class="text-break-word oc_resource-details">

                                    <a href="#" @click.prevent=" findElementToScroll({requirement}) ">
                                        <span v-if="displayStatus">
                                            <status-icon :status="cardStatus(requirement.target)" />
                                        </span>

                                        {{ resolveRequirementMatchTitle(requirement) }}
                                    </a>
                                </span>
                            </div>
                        </div>
                        <!-- TODO fix this -->
                        <div v-if="!isMobileLayout"
                            class="table-section oc-table-section section-wrap text-truncate section-30 align_left">
                            <gl-icon
                                v-if="displayValidation"
                                :size="14"
                                :class="{
                                    'icon-green': requirementSatisfied(requirement),
                                    'icon-red': !requirementSatisfied(requirement),
                                }"
                                :name="requirementSatisfied(requirement) ? 'check-circle-filled' : 'warning-solid'"
                            />
                            <span v-if="requirementMatchIsValid(requirement)" class="text-break-word oc_resource-details">

                                <a href="#" @click.prevent=" findElementToScroll({requirement}) ">
                                    <span v-if="displayStatus">
                                        <status-icon :status="cardStatus(requirement.target)" />
                                    </span>

                                    {{ resolveRequirementMatchTitle(requirement) }}
                                </a>
                            </span>
                        </div>

                        <div
                            v-if="!readonly && requirementMatchIsValid(requirement)"
                            class="table-section oc-table-section section-wrap text-truncate section-30 d-inline-flex flex-wrap justify-content-end">
                            <gl-button
                            v-if="getCurrentActionLabel(requirement) !== 'Disconnect'"
                                title="edit"
                                :aria-label="__(`edit`)"
                                type="button"
                                class="oc_requirements_actions"
                                @click.prevent="findElementToScroll({requirement})"
                                >{{ __('Edit') }}</gl-button>
                            <gl-button
                                :title="__(requirement.completionStatus || DEFAULT_ACTION_LABEL)"
                                :aria-label="__(requirement.completionStatus || DEFAULT_ACTION_LABEL)"
                                type="button"
                                class="gl-ml-3 oc_requirements_actions"
                                @click.prevent="openDeleteModal(idx, getCurrentActionLabel(requirement))">
                                {{
                                    getCurrentActionLabel(requirement) 
                                }}</gl-button>
                        </div>
                        <div
                            v-else-if="!readonly"
                            class="table-section oc-table-section section-wrap text-truncate section-30 d-inline-flex flex-wrap justify-content-end">
                            <gl-button
                                v-if="canConnectServices"
                                title="connect"
                                :aria-label="__(`connect`)"
                                type="button"
                                class="oc_requirements_actions"
                                :disabled="getValidConnections($route.params.environment, requirement).length == 0"
                                @click.prevent="connectToResource(requirement)"
                            >{{ __('Connect') }}</gl-button>

                            <gl-button
                                title="create"
                                :aria-label="__(`create`)"
                                type="button"
                                class="gl-ml-3 oc_requirements_actions"
                                :disabled="getValidResourceTypes(requirement, deploymentTemplate, getCurrentEnvironment).length == 0"
                                @click="sendRequirement(requirement)">{{ __('Create') }}</gl-button>
                        </div>
                    </div>
                </div>
            </div>
        </oc-tab>
        <oc-tab v-if="shouldRenderInputs" title="Specs" :titleCount="(card.template && card.template.properties || this.card.properties || []).length">
            <oc-properties-list v-if="readonly" :container-style="propertiesStyle" :card="card" property="inputs"/>
            <oc-inputs v-else :card="card" :main-inputs="getCardProperties(card)" />
        </oc-tab>
        <oc-tab v-if="shouldRenderOutputs" title="Attributes" :titleCount="card.attributes.length"></oc-tab>

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
