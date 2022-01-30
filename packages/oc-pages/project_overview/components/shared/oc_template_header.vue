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
}
</script>
<template>
    <div class="row gl-mt-4 gl-mb-4">
        <div class="col-md-12 col-lg-6 d-flex">
            <h1 class="gl-mt-3 gl-mb-0 template-title">{{ headerInfo.title }}</h1>
        </div>
        <div class="col-md-12 col-lg-6 d-inline-flex flex-wrap justify-content-lg-end gl-pt-4" style="align-items: center">
            <LogosCloud :cloud="headerInfo.cloud" :class="['gl-mr-1', 'logo-mt']" />
            <!--span style="line-height: 0;" v-if="headerInfo.cloud">{{headerInfo.cloud.split(/(?=[A-Z])/).slice(0, -1).join(' ')}}</span-->
            <span class="gl-pl-2 oc_environment_name">{{ headerInfo.environment }}</span> 
            <gl-icon
                :size="12"
                :class="['icon-blue']"
                style="margin: 0.25rem"
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
