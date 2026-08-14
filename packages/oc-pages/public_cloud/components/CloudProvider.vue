<script>
import {lookupCloudProviderAlias} from 'oc_vue_shared/util'
import {DetectIcon} from 'oc_vue_shared/components/oc'
export default {
  name: 'CloudProvider',
  props: {
    item: Object
  },
  components: {
    DetectIcon
  },
  computed: {
    providerName() {
      const cloud = this.item.data.name
      const ProviderNameMap = {
        [lookupCloudProviderAlias('gcp')]: 'Google Cloud',
        [lookupCloudProviderAlias('aws')]: 'Amazon Web Services',
        [lookupCloudProviderAlias('do')]: 'Digital Ocean',
        [lookupCloudProviderAlias('k8s')]: 'Kubernetes'
      }
      return ProviderNameMap[cloud] || cloud
    },
    providerTypeName() {
      return lookupCloudProviderAlias(this.item.data?.cloud)
    }
  }
}
</script>
<template>
  <div class="d-flex align-items-center">
    <detect-icon :size="22" :name="item.data.name"/> <h6 class="ml-1">{{providerName}}</h6>
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
