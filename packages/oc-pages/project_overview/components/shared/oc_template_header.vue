<script>
import { __ } from '~/locale';
import {DetectIcon} from 'oc_vue_shared/components/oc'
import {mapGetters} from 'vuex'
import {ProjectIcon} from 'oc_vue_shared/components/oc'
import {projectPathToHomeRoute} from 'oc_vue_shared/client_utils/dashboard'

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
      },
      environmentURL() {
          const homePath = projectPathToHomeRoute(decodeURIComponent(this.$route.params.dashboard))
          return `/${homePath}/-/environments/${this.getCurrentEnvironmentName}`
      }
    },
    methods: {
      returnHome() {
        // TODO re-enable this when we're able to update the current namespace 
        // https://github.com/onecommons/gitlab-oc/issues/867
        // this.$router.push({name: 'projectHome', slug: this.$route.params.slug})
        window.location.href = this.$router.resolve({name: 'projectHome', slug: this.$route.params.slug}).href
      }
    }
}
</script>
<template>
    <div class="m-2 d-flex flex-wrap justify-content-between align-items-center">
        <h1 @click="returnHome" class="template-title m-0"> <project-icon style="font-size: 0.83em; margin-right: 0.5em;" :project-icon="getApplicationBlueprint.projectIcon" /> {{ getApplicationBlueprint.title }}</h1>
        <a class="d-inline-flex align-items-center" :href="environmentURL" target="_blank">
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
  font-size: 1.5rem;
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
