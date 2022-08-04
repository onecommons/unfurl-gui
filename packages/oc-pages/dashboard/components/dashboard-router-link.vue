<script>
export default {
  name: 'DashboardRouterLink',
  props: {
    noRouter: {
      type: Boolean,
      default: false
    },
    href: {
      type: String | Object,
      required: true
    },
  },
  computed: {
    to() {
      return this.href?.to ? 
        this.href.to : 
        this.href.replace('/dashboard', '') // NOTE this works fine for now because this component is used in the dashboard only
    },
  }
}
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
