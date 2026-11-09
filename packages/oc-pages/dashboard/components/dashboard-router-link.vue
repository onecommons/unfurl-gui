<script lang="ts">
import {defineComponent} from 'vue'
import type {PropType} from 'vue'
import type {RouteLocationRaw} from '@gitlab/vue-router-vue3'
export default defineComponent({
  name: 'DashboardRouterLink',
  props: {
    noRouter: {
      type: Boolean,
      default: false
    },
    href: {
      // a dashboard path, or {to} for a route; may arrive after the first render
      type: [String, Object] as PropType<string | {to: RouteLocationRaw}>,
    },
  },
  computed: {
    to(): RouteLocationRaw | undefined {
      if(typeof this.href == 'string') {
        return this.href.replace('/dashboard', '') // NOTE this works fine for now because this component is used in the dashboard only
      }
      return this.href?.to
    },
    link(): string | undefined {
      return typeof this.href == 'string' ? this.href : undefined
    },
  }
})
</script>

<template>
  <router-link v-if="!noRouter && to" :to="to">
    <slot></slot>
  </router-link>
  <a v-else :href="link">
    <slot></slot>
  </a>
</template>

<style scoped>
</style>
