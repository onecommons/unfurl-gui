<script>
import {  GlFormRadio, GlIcon } from '@gitlab/ui';
import OcListResourceIcon from './oc_list_resource/icon.vue';
import { __ } from '~/locale';
import {lookupCloudProviderAlias} from 'oc_vue_shared/util.mjs'
import {mapGetters} from 'vuex';

const CLOUD_PROVIDER_NAMES = {
    [lookupCloudProviderAlias('gcp')]: __('Google Cloud Platform'),
    [lookupCloudProviderAlias('aws')]: __('Amazon Web Services'),
    [lookupCloudProviderAlias('azure')]: __('Azure'),
    [lookupCloudProviderAlias('k8s')]: __('Kubernetes')
}

export default {
    name: 'OcListResource',
    components: {
        GlFormRadio,
        GlIcon,
        OcListResourceIcon
    },

    data() {
        return {}
    },

    props: {
        validResourceTypes: {
          type: Array,
          required: true
        },
        value: {
            type: [Object, String],
            required: false,
            default: () => ''
        },
        resourceType: {
            type: String,
            required: false
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
        },

        ...mapGetters([
            'isMobileLayout',
            'resolveResourceTypeFromAny'
        ]),
        cloudProviderMappings() {
            const result = []
            for(const type of this.validResourceTypes) {
                let cloud = ''
                if(type.implementation_requirements) {
                    for(const implRequirement of type.implementation_requirements) {
                        cloud = CLOUD_PROVIDER_NAMES[lookupCloudProviderAlias(implRequirement)] || ''
                        if(cloud) break
                    }
                }
                result.push(cloud)
            }
            return result
        }
    },
    methods: {
        description(resource) {
            return resource.description || this.resolveResourceTypeFromAny(resource?.type)?.description
        },
        iconProps(resource) {
            const type = resource?.type ? this.resolveResourceTypeFromAny(resource?.type) : resource
            return {
                type,
                badge: type.badge,
                alt: resource.name
            }

        }

    }
};
</script>
<template>
    <div class="ci-table" role="grid">
        <div
            v-for="(resource) in validResourceTypes"
            :key="resource.name"
            class="gl-responsive-table-row oc_table_row"
        >
            <div class="table-section oc-table-section section-wrap text-truncate section-30 align_left gl-display-flex gl-pl-2">
                <gl-form-radio name="platform" v-model="selectedVal" :value="resource" class="gl-mt-4" />
                <div :data-testid="`resource-selection-${resource.name}`" @click="selectedVal = resource" class="modal-label d-flex justify-content-center flex-column">
                    <div class="d-flex">
                        <oc-list-resource-icon v-bind="iconProps(resource)"/>
                        <span class=" title">{{ resource.title }}</span>
                    </div>
                </div>
            </div>
            <!--div class="table-section oc-table-section section-wrap text-truncate section-20 text-center"> {{ cloudProviderMappings[idx] }} </div>
            <div class="table-section oc-table-section section-wrap text-truncate section-20 text-center"> {{ resourceType }} </div-->
            <div class="table-section oc-table-section section-wrap text-truncate section-60 align_left gl-display-flex gl-pl-2">
              <span class=" oc_resource-type">{{ description(resource) }}</span>
            </div>
            <div v-if="resource.details_url" class="table-section oc-table-section section-wrap text-truncate section-10 text-center">
                <span  class=" oc_resource-details">
                    <a :href="resource.details_url" rel="noopener noreferrer" target="_blank">
                        {{ __('Details') }}
                        <gl-icon :size="14" name="external-link" />
                    </a>
                </span>
            </div>
        </div>
    </div>
</template>
<style scoped>
.modal-label {
    cursor: pointer
}
span {
    display: flex;
    align-items: center;
}
</style>
