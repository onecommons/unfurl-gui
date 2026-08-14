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
  <div class="d-flex flex-column">
    <cloud-provider :item="item.parent"/>
    <div style="color: inherit">{{item.data.name}}</div>
  </div>
</template>
