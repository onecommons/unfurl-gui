<script>
import CloudProvider from './components/CloudProvider.vue'
import Deployment from './components/Deployment.vue'
import Region from './components/Region.vue'
import Account from './components/Account.vue'
import ResourceType from './components/ResourceType.vue'
import Vue from 'vue'

export default {
  name: 'Tooltip',
  props: {
    item: Object,
    left: {
      default: -1000
    },
    top: {
      default: -1000
    }
  },
  data() {
    return {
      isMousedOver: false,
      glDark: !!document.querySelector('.gl-dark'),
      zIndex: 5,
      opacity: 1,
      adjustedLeft: -1000,
      adjustedTop: -1000,
    }
  },
  methods: {
    calcLeft() {
      try {
        const {width} = this.$refs.container.getBoundingClientRect()
        if(window.innerWidth < (this.left + width)) {
          return this.left - width
        }
      } catch(e) {}
      return this.left
    },
    calcTop() {
      try {
        const {height} = this.$refs.container.getBoundingClientRect()
        if(window.innerHeight < (this.top + height)) {
          return this.top - height
        }
      } catch(e) {}
      return this.top
    }
  },
  computed: {
    componentType() {
      switch(this.item?.data?.kind) {
        case 'type':
          return ResourceType
        case 'cloud':
          return this.item?.data?.name != 'unassociated' && CloudProvider
      }
      /*
      if(type == 'cloudprovider') return CloudProvider
      if(type == 'app') return Deployment
      if(type == 'region') return Region
      if(type == 'account') return Account
      */
      return null
    }
  },
  watch: {
    isMousedOver(val, prev) {
      if(!val) {
        this.opacity = 0
        this.zIndex = -1
      }
    },
    async item(val) {
      this.zIndex = -1
      this.opacity = 0
      await Vue.nextTick()
      this.adjustedLeft = this.calcLeft()
      this.adjustedTop = this.calcTop()
      await Vue.nextTick()
      this.zIndex = 5
      this.opacity = 1
    }
  },

}
</script>
<template>
  <div
    v-if="componentType"
    id="tooltip"
    ref="container"
    class="position-fixed"
    :style="`z-index: ${zIndex}; left: ${adjustedLeft}px; top: ${adjustedTop}px; opacity: ${opacity}`"
    @mouseenter="isMousedOver = true"
    @mouseleave="isMousedOver = false"
  >
    <div class="cloud-tooltip" :class="{'gl-dark': glDark}">
      <component :is="componentType" :item="item" :isTooltip="true"/>
    </div>
  </div>

</template>
<style scoped>
.cloud-tooltip {
  background-color: white;
  border-width: 1px;
  border-color: #A0A0A0;
  border-style: solid;
  border-radius: 4px;
  color: black;
  min-width: 140px;
  padding: 8px;

  /* not sure what this was originally for */
  /* white-space: pre; */
}

.cloud-tooltip.gl-dark {
  background-color: #4A5053;
  border-color: #A0A0A0;
  color: white;
}

</style>
