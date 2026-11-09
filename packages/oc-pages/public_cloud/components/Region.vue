<script lang="ts">
import {defineComponent} from 'vue'
import type {PropType} from 'vue'
import type {Node} from '../index'
import CloudProvider from './CloudProvider.vue'

export default defineComponent({
  name: 'Region',
  props: {
    item: {type: Object as PropType<Node>, required: true}
  },
  components: {
    CloudProvider
  }
})
</script>
<template>
  <div class="gl-flex gl-flex-col">
    <cloud-provider v-if="item.parent" :item="item.parent"/>
    <div style="color: inherit">{{item.data.name}}</div>
  </div>
</template>
