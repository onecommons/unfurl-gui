<script>
import { __ } from '~/locale';
import {DetectIcon} from '../../../vue_shared/oc-components'

export default {
    name: 'OcTemplateHeader',
    components: {
        DetectIcon
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
          <a :href="`/dashboard/environments/${headerInfo.environment}`" target="_blank">
            <span class="gl-pl-2 oc_environment_name mr-2">{{ headerInfo.environment }}</span> 
            <detect-icon :size="18" :type="headerInfo.cloud" />
          </a>
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
