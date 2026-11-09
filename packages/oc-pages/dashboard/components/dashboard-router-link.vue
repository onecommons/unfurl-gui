<script lang="ts">
import {defineComponent} from 'vue'
import type {PropType} from 'vue'
export default defineComponent({
  name: 'DashboardRouterLink',
  props: {
    noRouter: {
      type: Boolean,
      default: false
    },
    href: {
      type: [String, Object] as PropType<any>,
      // required: true
      // this is required, but it might not be available immediately as a prop, which can cause confusing error messages
    },
  },
  computed: {
    to() {
      return this.href?.to ?
        this.href.to :
        this.href.replace('/dashboard', '') // NOTE this works fine for now because this component is used in the dashboard only
    },
  }
})
</script>

<template>
  <router-link v-if="!noRouter" :to="to">
    <slot></slot>
  </router-link>
  <a v-else :href="href">
    <slot></slot>
  </a>
</template>

<style scoped>
</style>
