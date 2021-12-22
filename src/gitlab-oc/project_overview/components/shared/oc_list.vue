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
        tabsTitle: {
            type: String,
            required: false,
            default: __('List')
        },
        templateRequirements: {
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
    },
    data() {
        return {
            resourceName: '',
        }
    },

    computed: {
        ...mapGetters({
            resources: 'getResources',
            servicesToConnect: 'getServicesToConnect',
        }),
        checkRequirements() {
            const flag = this.templateRequirements.filter((r) => r.status === true).length === this.templateRequirements.length;
            bus.$emit('completeRequirements', this.level, flag);
            return flag;
        }
    },

    methods: {
        ...mapActions([
            'setRequirementSelected',
        ]),

        findElementToScroll({requirement}) {
            bus.$emit('moveToElement', {elId: requirement.fullfilled_by});
        },

        connectToResource({requirement}) {
            this.setRequirementSelected({requirement, titleKey: this.titleKey});
            bus.$emit('launchModalToConnect');
        },

        sendRequirement(requirement) {
            this.setRequirementSelected({requirement, titleKey: this.titleKey});
            bus.$emit('placeTempRequirement');
        },

        openDeleteModal(title, action=__("Remove")) {
            bus.$emit('deleteNode', {title, level: this.level, titleKey: this.titleKey, action});
        },

        getRemoveOrDisconnectLabel(requirement) {
            if(!requirement.connectedOrCreated) return '';
            return requirement.connectedOrCreated === "connected" ? __('Disconnect') : __("Remove")
        },

        hasTemplateResources({type}) {
            const result = this.resources.filter(r => r.type.toLowerCase().includes(type.toLowerCase()));
            if(result.length > 0) return true;
            return false;
        },

        hasResourcesToConnect({type}) {
            const result = this.servicesToConnect.filter(r => r.type.toLowerCase().includes(type.toLowerCase()));
            if(result.length > 0) return true;
            return false;
        },
    }
}
</script>
<template>
    <div v-if="templateRequirements.length > 0">
        <gl-tabs class="gl-mt-6">
            <gl-tab class="gl-mt-6">
                <template slot="title">
                    <span>{{ tabsTitle }}</span>
                    <gl-icon
                        :size="14"
                        :class="{
                            'icon-green': checkRequirements,
                            'icon-red': !checkRequirements,
                            'gl-ml-4 gl-mt-1': true
                        }"
                        :name="checkRequirements ? 'check-circle-filled' : 'warning-solid'"
                        />
                </template>
                <div class="row-fluid">
                    <div class="ci-table" role="grid">
                        <div
                            v-for="(requirement, idx) in templateRequirements"
                            :key="requirement + idx + '-template'"
                            class="gl-responsive-table-row oc_table_row">
                            <div
                                class="table-section oc-table-section section-wrap text-truncate section-40 align_left">
                                <gl-icon :size="16" class="gl-mr-2 icon-gray" :name="detectIcon(requirement.title)" />
                                <span class="text-break-word title">{{  showTypeFirst ? requirement.type : requirement.title }}</span>
                                <div class="oc_requirement_description gl-mb-2">
                                {{ requirement.description }}
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
                                v-if="requirement.fullfilled_by !== null"
                                class="text-break-word oc_resource-details"
                                >
                                <a
                                    href="#"
                                    @click.prevent="
                                    findElementToScroll({requirement})
                                    "
                                >
                                    {{ requirement.fullfilled_by }}
                                    </a
                                >
                                </span>
                            </div>

                            <div
                                v-if="requirement.fullfilled_by !== null"
                                class="table-section oc-table-section section-wrap text-truncate section-30 d-inline-flex flex-wrap justify-content-lg-end">
                                <gl-button
                                v-if="getRemoveOrDisconnectLabel(requirement) !== 'Disconnect'"
                                    title="edit"
                                    :aria-label="__(`edit`)"
                                    type="button"
                                    class="oc_requirements_actions"
                                    @click.prevent="findElementToScroll({requirement})"
                                    >{{ __('Edit') }}</gl-button>
                                <gl-button
                                    title="edit"
                                    :aria-label="__(`edit`)"
                                    type="button"
                                    class="gl-ml-3 oc_requirements_actions"
                                    @click.prevent="openDeleteModal(requirement.fullfilled_by, getRemoveOrDisconnectLabel(requirement))">
                                    {{
                                        getRemoveOrDisconnectLabel(requirement) 
                                    }}</gl-button>
                            </div>
                            <div
                                v-else
                                class="table-section oc-table-section section-wrap text-truncate section-30 d-inline-flex flex-wrap justify-content-lg-end">
                                <gl-button
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
                                    :disabled="!hasTemplateResources(requirement)"
                                    @click="sendRequirement(requirement)">{{ __('Create') }}</gl-button>
                            </div>
                        </div>
                    </div>
                </div>
            </gl-tab>
        </gl-tabs>
    </div>
</template>
