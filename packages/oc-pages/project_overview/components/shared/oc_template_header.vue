<script>
import { __ } from '~/locale';
import {DetectIcon} from 'oc_vue_shared/oc-components'
import {mapGetters} from 'vuex'
import {ProjectIcon} from 'oc_vue_shared/oc-components'

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
          'getCurrentEnvironmentType',
          'getCurrentEnvironmentName'
      ]),
      cloud() {
        if(!this.getCurrentEnvironmentType && this.getCurrentEnvironmentName) {
          return 'local dev'
        }
        return this.getCurrentEnvironmentType
      }
    },
    methods: {
      returnHome() {
        this.$router.push({name: 'projectHome', slug: this.$route.params.slug})
      }
    }
}
</script>
<template>
    <div class="m-2 d-flex flex-wrap justify-content-between align-items-center">
        <h1 @click="returnHome" class="template-title m-0"> <project-icon style="font-size: 0.83em; margin-right: 0.5em;" :project-icon="getApplicationBlueprint.projectIcon" /> {{ getApplicationBlueprint.title }}</h1>
        <a class="d-inline-flex align-items-center" :href="`/dashboard/environments/${getCurrentEnvironmentName}`" target="_blank">
            <span class="gl-pl-2 oc_environment_name mr-2">{{ getCurrentEnvironmentName }}</span> 
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

h1 { cursor: pointer; }
</style>
