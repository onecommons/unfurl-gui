<script lang="ts">
import {defineComponent} from 'vue'
import type {PropType} from 'vue'
import CloudProvider from './CloudProvider.vue'

export default defineComponent({
  name: 'Region',
  props: {
    item: Object as PropType<any>
  },
  components: {
    CloudProvider
  }
})
</script>
<template>
  <div class="gl-flex gl-flex-col">
    <cloud-provider :item="item.parent"/>
    <div style="color: inherit">{{item.data.name}}</div>
  </div>
</template>
