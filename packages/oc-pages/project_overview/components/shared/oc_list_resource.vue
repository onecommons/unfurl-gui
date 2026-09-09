<script>
import {  GlFormRadio, GlIcon } from '@gitlab/ui';
import OcListResourceIcon from './oc_list_resource/icon.vue';
import { __ } from '~/locale';
import {lookupCloudProviderAlias} from 'oc_vue_shared/util'
import {mapGetters, mapActions} from 'vuex';

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
        OcListResourceIcon,
    },

    data() {
        return {ready: true}
    },

    // MODE 3 and modelValue are one change: @vue/compat rewrites modelValue
    // back to value for any component still on the Vue 2 contract, so a
    // component cannot move on its own. Callers keep v-model.
    //
    // COMPONENT_V_MODEL: false is not redundant with MODE 3. isCompatEnabled
    // reads the flag before the mode, and under MODE 3 a flag still counts as
    // on when its value is 'suppress-warning' -- which is what compat_config
    // sets for nearly every flag. MODE 3 alone would change nothing here.
    compatConfig: {MODE: 3, COMPONENT_V_MODEL: false},
    emits: ['update:modelValue'],
    props: {
        validResourceTypes: {
          type: Array,
          required: true
        },
        modelValue: {
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
                return this.modelValue;
            },
            set(val) {
                this.$emit("update:modelValue", val);
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
                badge: type?.badge,
                alt: resource.name
            }

        },
        ...mapActions(['fetchDeploymentIfNeeded'])
    },
    watch: {
        validResourceTypes: {
            immediate: true,
            // this works well, but is a weird place to be loading state on demand
            async handler(val) {
                this.ready = false
                if(!val) return
                const promises = val.map(typeOrTemplate => {
                    if(typeOrTemplate?.imported) {
                        return this.fetchDeploymentIfNeeded(typeOrTemplate)
                    }
                })

                await Promise.all(promises)

                this.ready = true
            }
        }
    }
};
</script>
<template>
    <div v-if="ready" class="ci-table" role="grid">
        <div
            v-for="(resource) in validResourceTypes.filter(r => !!r)"
            :key="resource.name"
            class="gl-responsive-table-row oc_table_row"
        >
            <div class="table-section oc-table-section section-wrap gl-truncate section-30 align_left gl-flex gl-pl-2">
                <gl-form-radio name="platform" v-model="selectedVal" :value="resource" class="gl-mt-4" />
                <div :data-testid="`resource-selection-${resource._localName || resource.name}`" @click="selectedVal = resource" class="modal-label gl-flex gl-justify-center gl-flex-col">
                    <div class="gl-flex">
                        <oc-list-resource-icon v-bind="iconProps(resource)"/>
                        <span class=" title">{{ resource.title || resource.name }}</span>
                    </div>
                </div>
            </div>
            <!--div class="table-section oc-table-section section-wrap gl-truncate section-20 gl-text-center"> {{ cloudProviderMappings[idx] }} </div>
            <div class="table-section oc-table-section section-wrap gl-truncate section-20 gl-text-center"> {{ resourceType }} </div-->
            <div class="table-section oc-table-section section-wrap gl-truncate section-60 align_left gl-flex gl-pl-2">
                <span class=" oc_resource-type"><oc-markdown-view :content="description(resource)" /></span>
            </div>
            <div v-if="resource.details_url" class="table-section oc-table-section section-wrap gl-truncate section-10 gl-text-center">
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
