<script>
import CloudProvider from './CloudProvider.vue'

export default {
  name: 'Region',
  props: {
    item: Object
  },
  components: {
    CloudProvider
  }
}
</script>
<template>
  <div class="gl-flex gl-flex-col">
    <cloud-provider :item="item.parent"/>
    <div style="color: inherit">{{item.data.name}}</div>
  </div>
</template>
