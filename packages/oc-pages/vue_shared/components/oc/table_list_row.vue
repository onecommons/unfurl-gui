<script>
import { GlIcon , GlButton, GlModalDirective } from "@gitlab/ui";
import { bus } from 'oc_vue_shared/bus';
import { mapGetters } from 'vuex';

import { __ } from '~/locale';


export default {
    name: "TableListRow",
    components: {
        GlIcon,
        GlButton,
    },
    directives: {
        GlModal: GlModalDirective,
    },
    props: {
        items: {
            type: Array,
            required: true
        },
        editable: {
            type: Boolean,
            required: false
        },
    },
    data() {
        return {}
    },
    methods: {
        deployTemplate(template) {
            bus.$emit('deployTemplate', template);
        },

        editTemplate(template) {
            bus.$emit('editTemplate', template);
        },
        redirectToDeployment() {
            window.location.href = this.$projectGlobal.linkDeployment;
        }
    },
    computed: {
        ...mapGetters([
            'environmentsAreReady',
            'getUsername'
        ]),
        disableDeployButton() {
            return this.getUsername && !this.environmentsAreReady
        }
    },
}
</script>
<template>
    <div>
        <div v-if="items.length > 0">
            <div v-for="(item, index) in items.filter(item => item)" :key="item + index" class="gl-responsive-table-row oc_table_row">
                <div class="table-section oc-table-section section-wrap text-truncate section-25">
                    <span class=" title">{{ item.title || item.name }}</span>
                </div>
                <div class="table-section oc-table-section section-wrap text-truncate section-40">
                    <div class="light-gray"><oc-markdown-view :content="item.description" /></div>
                </div>

                <div class="table-section oc-table-section section-wrap text-truncate section-15">
                    <a v-if="item.totalDeployments" href="javascript:void(0);" @click="redirectToDeployment()">
                        <span>
                            <gl-icon
                                name="upload"
                                class="options-expanded-icon gl-mr-1"/>
                        </span>
                        <span class=" ">{{ __(`${item.totalDeployments} Deployments`)  }}</span>
                    </a>
                </div>

                <div class="table-section oc-table-section section-wrap text-truncate section-20">
                    <span class=" deploy-button-group">
                            <gl-button
                                v-if="editable"
                                :title="__('Edit')"
                                :aria-label="__('Edit')"
                                icon="pencil"
                                type="button"
                                @click="editTemplate(item)">{{ __("Edit") }}</gl-button>
                            <gl-button
                                :title="__('Deploy')"
                                :aria-label="__('Deploy')"
                                :data-testid="`deploy-template-${item.name}`"
                                class="deploy-action"
                                icon="upload"
                                type="button"
                                :disabled="disableDeployButton"
                                @click="deployTemplate(item)" >{{ __("Deploy") }}</gl-button>
                    </span>
                </div>
            </div>
        </div>
        <div v-else class="gl-responsive-table-row oc_table_row">
            <div class="table-section oc-table-section section-wrap text-center section-100">
                <div>{{ __("Templates not found") }}</div>
            </div>
        </div>
    </div>
</template>
<style scoped>
.light-gray {
    color: #666666;
}
.deploy-button-group {
    float: right;
}
</style>
