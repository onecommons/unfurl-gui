<script>
import { GlIcon , GlButton, GlModalDirective } from "@gitlab/ui";
import { bus } from '../../../project_overview/bus';

import { __ } from '~/locale';


export default {
    name: "TableListRow",
    components: {
        GlIcon,
        GlButton
    },
    directives: {
        GlModal: GlModalDirective,
    },
    props: {
        items: {
            type: Array,
            required: true
        }
    },
    methods: {
        selectTemplate(template) {
            bus.$emit('setTemplate', template);
        },

        editTemplate(template) {
            bus.$emit('editTemplate', template);
            // this.$router.push({ name: 'templatePage', params: { slug: this.templateSelected.slug}});
        },
        redirectToDeployment() {
            window.location.href = this.$projectGlobal.linkDeployment;
        }
    }
}
</script>
<template>
    <div>
        <div v-if="items.length > 0">
            <div v-for="(item, index) in items" :key="item + index" class="gl-responsive-table-row oc_table_row">
                <div class="table-section oc-table-section section-wrap text-truncate section-40">
                    <span class="text-break-word title">{{ item.title }}</span>
                    <div class="light-gray">{{ item.description }}</div>
                </div>
                <div class="table-section oc-table-section section-wrap text-truncate section-25">
                    <span class="text-break-word light-gray">{{ item.cloud }}</span>
                </div>

                <div class="table-section oc-table-section section-wrap text-truncate section-15">
                    <a href="javascript:void(0);" @click="redirectToDeployment()">
                        <span>
                            <gl-icon
                                name="upload"
                                class="options-expanded-icon gl-mr-1"/>
                        </span>
                        <span class="text-break-word ">{{ __(`${item.totalDeployments} Deployments`)  }}</span>
                    </a>
                </div>

                <div class="table-section oc-table-section section-wrap text-truncate section-20">
                    <span class="text-break-word deploy-button-group">
                            <gl-button
                                :title="__('Edit')"
                                :aria-label="__('Edit')"
                                icon="pencil"
                                type="button"
                                @click="editTemplate(item)">{{ __("Edit") }}</gl-button>
                            <gl-button
                                v-gl-modal.oc-templates-deploy
                                :title="__('Deploy')"
                                :aria-label="__('Deploy')"
                                class="deploy-action"
                                icon="upload"
                                type="button"
                                @click="selectTemplate(item)" >{{ __("Deploy") }}</gl-button>
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
