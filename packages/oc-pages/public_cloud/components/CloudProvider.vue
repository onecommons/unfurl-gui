<script lang="ts">
import {defineComponent} from 'vue'
import type {PropType} from 'vue'
import type {Node} from '../index'
import {lookupCloudProviderAlias} from 'oc_vue_shared/util'
import {DetectIcon} from 'oc_vue_shared/components/oc'
export default defineComponent({
  name: 'CloudProvider',
  props: {
    item: {type: Object as PropType<Node>, required: true}
  },
  components: {
    DetectIcon
  },
  computed: {
    providerName() {
      const cloud = this.item.data.name
      const ProviderNameMap = {
        [lookupCloudProviderAlias('gcp') as string]: 'Google Cloud',
        [lookupCloudProviderAlias('aws') as string]: 'Amazon Web Services',
        [lookupCloudProviderAlias('do') as string]: 'Digital Ocean',
        [lookupCloudProviderAlias('k8s') as string]: 'Kubernetes'
      }
      return ProviderNameMap[cloud] || cloud
    },
    providerTypeName() {
      return lookupCloudProviderAlias(this.item.data?.cloud)
    }
  }
})
</script>
<template>
  <div class="gl-flex gl-items-center">
    <detect-icon :size="22" :name="item.data.name"/> <h6 class="gl-ml-2">{{providerName}}</h6>
  </div>
</template>
<style scoped>
h6 {
  font-size: 1.05em;
  font-weight: bold;
  color: inherit !important;
  margin: 0;
}
</style>
