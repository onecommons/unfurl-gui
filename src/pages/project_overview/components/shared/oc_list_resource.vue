<script>
import {  GlFormRadio, GlIcon } from '@gitlab/ui';
import { __ } from '~/locale';
export default {
    name: 'OcListResource',
    components: {
        GlFormRadio,
        GlIcon
    },

    props: {
        filteredResourceByType: {
            type: Array,
            required: true,
        },
        value: {
            type: [Object, String],
            required: true,
        },
        nameOfResource: {
            type: String,
            required: true,
        },
        cloud: {
            type: String,
            required: true,
        }
    },

    computed: {
        selectedVal: {
            get() {
                return this.value;
            },
            set(val) {
                this.$emit("input", val); 
            }
        }
    },

    methods: {
        checkCompatibility(itemPlatform) {
            return itemPlatform === this.cloud ||
                    itemPlatform === __("SaaS Service") ||
                    itemPlatform === __("Self-Hosted");
        }
    }
};
</script>
<template>
    <div>
        <p>
        {{
            filteredResourceByType.length > 0
            ? __('Choose one of these options')
            : __('Does not exist template for')
        }}
        {{ nameOfResource }}
        </p>
        <div class="ci-table" role="grid">
        <div
            v-for="(resource, idx) in filteredResourceByType"
            :key="resource + idx"
            class="gl-responsive-table-row oc_table_row"
        >
            <div  v-if="!checkCompatibility(resource.platform)" class="uf-faded-row"></div>
            <div
            class="table-section oc-table-section section-wrap text-truncate section-40 align_left gl-display-flex gl-pl-2"
            >
            <gl-form-radio v-model="selectedVal" :value="resource" class="gl-mt-4" :disabled="!checkCompatibility(resource.platform)"  />
            <div class="oc_resource_icon gl-mr-3">
                <img v-if="resource.avatar !== null" :src="resource.avatar" :alt="resource.name" />
            </div>
            <div>
                <span class="text-break-word title">{{ resource.name }}</span>
                <div class="oc_resource_description gl-mb-2">
                {{ resource.description }}
                </div>
            </div>
            </div>
            <div class="table-section oc-table-section section-wrap text-truncate section-20">
            <span class="text-break-word oc_resource-type">{{ resource.platform }}</span>
            </div>
            <div class="table-section oc-table-section section-wrap text-truncate section-20">
            <span class="text-break-word oc_resource-type">{{ resource.type }}</span>
            </div>

            <div
            class="table-section oc-table-section section-wrap text-truncate section-20 text-center"
            >
            <span class="text-break-word oc_resource-details">
                <a href="javascript:void();"
                >{{ __('Details') }}
                <gl-icon :size="12" name="external-link" />
                </a>
            </span>
            </div>
        </div>
        </div>
    </div>
</template>
<style scoped>
.oc_resource_icon {
    width: 36px;
    height: 36px;
    background-color: #ffffff;
}
.oc_resource_icon img {
    width: 100%;
    height: 100%;
}
</style>
