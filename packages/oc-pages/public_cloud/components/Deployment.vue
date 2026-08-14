<script>
import {DetectIcon} from 'oc_vue_shared/components/oc'
export default {
  name: 'CloudProvider',
  components: {DetectIcon},
  props: {
    item: Object,
    isTooltip: Boolean
  },
  computed: {
    presentableResources() {
      return this.item.children.map(child => child.data)//.filter(resource => resource.icon)
    },
    resourcesCountLabel() {
      const count = this.presentableResources.length

      if(count == 1){
        return `${count} Public Resource:`
      } else {
        return `${count} Public Resources:`
      }
    }
  }
}
</script>
<template>
  <div class="d-flex flex-column">
    <h6>{{item.data.name}}</h6>
    <a :href="item.data.visit" target="_blank">View Deployment</a>
    <div>{{resourcesCountLabel}}</div>
    <div class="d-flex flex-wrap tooltip-icons">
      <div v-for="resource in presentableResources" :key="resource.name" :title="resource.name">
        <a :href="`${item.data.visit}#${resource.name}`" target="_blank" style="color: inherit;">
          <img v-if="resource.name == 'the_app'" :src="item.data.icon">
          <img v-else-if="resource.icon" :src="resource.icon">
          <detect-icon v-else :type="resource.resourceType" />
        </a>
      </div>
    </div>
  </div>
</template>
<style scoped>
h6 {
  font-size: 1.05em;
  font-weight: bold;
  color: inherit !important;
  margin-top: 0;
}

.tooltip-icons {
  margin: 0 -0.15em;
}

.tooltip-icons >>> img {
  width: 32px; height: 32px; padding: 0.15em;
}

.tooltip-icons >>> svg {
  width: 32px; height: 32px; padding: 0.15em;
}

.tooltip-icons >>> .custom-icon {
  width: 32px; height: 32px;
}

</style>
