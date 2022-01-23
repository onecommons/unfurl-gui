<script>
import { GlTabs, GlTab, GlIcon, GlButton } from '@gitlab/ui';
import { bus } from '../../bus';
import { __ } from '~/locale';
import commonMethods from '../mixins/commonMethods';
import { mapGetters, mapActions } from 'vuex'

export default {
    name: 'OcList',
    components: {
        GlTabs,
        GlTab,
        GlIcon,
        GlButton
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
        templateDependencies: {
            type: Array,
            required: true,
            default: () => []
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
        }


    },
    data() {
        return {
            resourceName: '',
            DEFAULT_ACTION_LABEL: 'Add a new provider'
        }
    },

    computed: {
        ...mapGetters({
            resources: 'getResourceTemplates',
            servicesToConnect: 'getServicesToConnect',
            servicesToConnect: 'getServicesToConnect',
            getValidResourceTypes: 'getValidResourceTypes',
            //resolveResourceTemplate: 'resolveResourceTemplate',
            matchIsValid: 'matchIsValid',
            resolveMatchTitle: 'resolveMatchTitle',
            cardDependenciesAreValid: 'cardDependenciesAreValid',

        }),
        checkRequirements() {
            const flag = this.templateDependencies.filter((r) => r.status === true).length === this.templateDependencies.length;
            bus.$emit('completeRequirements', this.level, flag);
            return flag;
        },
        canConnectServices() {
            return this.$route.name != 'templatePage'
        }
    },

    methods: {
        ...mapActions([
            'setRequirementSelected',
        ]),

        findElementToScroll({requirement}) {
            bus.$emit('moveToElement', {elId: requirement.match});
        },

        connectToResource({requirement}) {
            this.setRequirementSelected({requirement, titleKey: this.titleKey});
            bus.$emit('launchModalToConnect');
        },

        sendRequirement(requirement) {
            this.setRequirementSelected({requirement, titleKey: this.titleKey});  // TODO trying to make this redundant
            
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


        hasResourcesToConnect(requirement) {
            return false
            const type = requirement.name
            const result = this.servicesToConnect.some(r => r.type.toLowerCase().includes(type.toLowerCase()));
            return result
            //const result = this.servicesToConnect.filter(r => r.type.toLowerCase().includes(type.toLowerCase()));
            //if(result.length > 0) return true;
            //return false;
        },
    }
}
</script>
<template>
    <div v-if="card.dependencies && card.dependencies.length > 0">
        <gl-tabs class="gl-mt-6">
            <gl-tab class="gl-mt-6">
                <template slot="title">
                    <span>{{ tabsTitle }}</span>
                    <gl-icon
                        :size="14"
                        :class="{
                            'icon-green': cardDependenciesAreValid(card),
                            'icon-red': !cardDependenciesAreValid(card),
                            'gl-ml-4 gl-mt-1': true
                        }"
                        :name="cardDependenciesAreValid(card) ? 'check-circle-filled' : 'warning-solid'"
                        />
                </template>
                <div class="row-fluid">
                    <div class="ci-table" role="grid">
                        <div
                            v-for="(requirement, idx) in card.dependencies"
                            :key="requirement.name + idx + '-template'"
                            class="gl-responsive-table-row oc_table_row">
                            <div
                                class="table-section oc-table-section section-wrap text-truncate section-40 align_left">
                                <gl-icon :size="16" class="gl-mr-2 icon-gray" :name="detectIcon(requirement.name)" />
                                <span class="text-break-word title">{{ requirement.name }}</span>
                                <div class="oc_requirement_description gl-mb-2">
                                {{ requirement.description}}
                                </div>
                            </div>
                            <div class="table-section oc-table-section section-wrap text-truncate section-10 align_left"></div>
                            <div
                                class="table-section oc-table-section section-wrap text-truncate section-20 align_left">
                                <gl-icon
                                :size="14"
                                :class="{
                                    'icon-green': requirement.status,
                                    'icon-red': !requirement.status,
                                }"
                                :name="requirement.status ? 'check-circle-filled' : 'warning-solid'"
                                />
                                <span
                                v-if="matchIsValid(requirement.match)"
                                class="text-break-word oc_resource-details"
                                >
                                <a
                                    href="#"
                                    @click.prevent="
                                    findElementToScroll({requirement})
                                    "
                                >
                                    {{ resolveMatchTitle(requirement.match) }}
                                    </a
                                >
                                </span>
                            </div>

                            <div
                                v-if="matchIsValid(requirement.match)"
                                class="table-section oc-table-section section-wrap text-truncate section-30 d-inline-flex flex-wrap justify-content-lg-end">
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
                                v-else
                                class="table-section oc-table-section section-wrap text-truncate section-30 d-inline-flex flex-wrap justify-content-lg-end">
                                <gl-button
                                    v-if="canConnectServices"
                                    title="connect"
                                    :aria-label="__(`connect`)"
                                    type="button"
                                    class="oc_requirements_actions"
                                    :disabled="!hasResourcesToConnect(requirement)"
                                    @click.prevent="connectToResource({requirement})"
                                >{{ __('Connect') }}</gl-button>

                                <gl-button
                                    title="create"
                                    :aria-label="__(`create`)"
                                    type="button"
                                    class="gl-ml-3 oc_requirements_actions"
                                    :disabled="getValidResourceTypes(requirement, deploymentTemplate).length == 0"
                                    @click="sendRequirement(requirement)">{{ __('Create') }}</gl-button>
                            </div>
                        </div>
                    </div>
                </div>
            </gl-tab>
        </gl-tabs>
    </div>
</template>
<style scoped>
.oc_requirements_actions {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
</style>
