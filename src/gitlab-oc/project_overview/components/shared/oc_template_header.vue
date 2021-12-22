<script>
import { GlIcon } from "@gitlab/ui";
import { __ } from '~/locale';
import LogosCloud from '../../components/shared/logos_cloud.vue';

export default {
    name: 'OcTemplateHeader',
    components: {
        GlIcon,
        LogosCloud
    },
    props: {
        headerInfo: {
            type: Object,
            required: true,
        }
    },
    methods: {
        checkPlatform() {
            switch (this.headerInfo.cloud) {
                case __('Google Cloud Platform'):
                    return 'GPC'
                case __('Amazon Web Services'):
                    return 'AWS'
                default:
                    return ''
            }
        }
    }
}
</script>
<template>
    <div class="row gl-mt-4 gl-mb-4">
        <div class="col-md-12 col-lg-6 d-flex">
            <h1 class="gl-mt-3 gl-mb-0 template-title">{{ headerInfo.title }}</h1>
        </div>
        <div class="col-md-12 col-lg-6 d-inline-flex flex-wrap justify-content-lg-end gl-pt-4">
            <LogosCloud :cloud="checkPlatform()" :class="['gl-mr-1', 'logo-mt']" />
            <span v-if="checkPlatform() !== ''">/</span>
            <span class="gl-pl-2 oc_environment_name">{{ headerInfo.environment }}</span> 
            <gl-icon
                :size="12"
                :class="['gl-ml-2', 'gl-mt-2', 'icon-blue']"
                :name="'information-o'"
                />
        </div>
    </div>
</template>
<style>
.icon-blue {
    color: #1F75CB;;
}
.template-title {
  font-size: 21px !important;
  color: #303030;
  font-style: normal;
  line-height: 24px;
}
.logo-mt {
    margin-top: 1px;
}
</style>
