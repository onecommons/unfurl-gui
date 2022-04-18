<script>
import { __ } from '~/locale';
import {DetectIcon} from '../../../vue_shared/oc-components'
import {mapGetters} from 'vuex'
import {ProjectIcon} from '../../../vue_shared/oc-components'

export default {
    name: 'OcTemplateHeader',
    components: {
        DetectIcon,
        ProjectIcon
    },
    computed: {
      ...mapGetters([
          'getPrimaryCard',
          'getApplicationBlueprint',
          'getCurrentEnvironment'
      ]),
      cloud() {
          return this.getCurrentEnvironment?.primary_provider?.type
      },
      environmentName() {
          return this.getCurrentEnvironment?.name
      }

    }
}
</script>
<template>
    <div class="m-2 d-flex justify-content-between align-items-center">
        <h1 class="template-title m-0"> <project-icon style="font-size: 0.83em; margin-right: 0.5em;" :project-icon="getApplicationBlueprint.projectIcon" /> {{ getApplicationBlueprint.title }}</h1>
        <a :href="`/dashboard/environments/${environmentName}`" target="_blank">
            <span class="gl-pl-2 oc_environment_name mr-2">{{ environmentName }}</span> 
            <detect-icon :size="18" :type="cloud" />
        </a>
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
  align-items: center;
  display: flex;
}
.logo-mt {
    margin-top: 1px;
}
</style>
