<script>
export default {
  name: 'Account',
  props: {
    item: Object
  },
  computed: {
    firstChild() {
      if(this.item.children.length == 0) return null
      return this.item.children[0]?.data
    },
    dashboard() {
      if(!this.firstChild) return ''
      const pathname = (new URL(this.firstChild.dashboard_url))?.pathname
      return pathname && pathname.slice(1).split('.git')[0]
    }
  }
}
</script>
<template>
  <div class="gl-flex gl-flex-col">
    <div class="gl-flex gl-items-center">
      <img style="width: 1.25em; height: 1.25em; border-radius: 0.75em;" :src="item.data.icon"> <h6 class="gl-ml-2">{{item.data.name}}</h6>
    </div>
    <div v-if="dashboard" class="gl-mt-2">{{dashboard}}</div>
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
