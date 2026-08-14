<script>
const NAV_STRUCTURE = ['Cloud Provider', 'Region', 'Test Bed Project']
export default {
  name: 'Navbar',
  props: {
    top: Number,
    focus: Object,
  },
  computed: {
    path() {
      if(!this.focus || this.focus.depth == 0) return []
      const result = []
      let n = this.focus
      while(n.depth > 0) {
        result.unshift(n.data.name)
        n = n.parent
      }
      return result
    },
    navItems() {
      if(this.path.length < NAV_STRUCTURE.length) {
        return this.path.concat(NAV_STRUCTURE.slice(Math.max(this.path.length, -1, 0)))
      }
      return this.path
    }
  },
  methods: {
    onClick(i) {
      if(!this.path) return
      if(!(this.path.length - i > 1)) return // if we click on the last element do nothing
      let newFocus = this.focus
      for(let j = this.path.length - 1;  j > i; j--) {
        newFocus = newFocus.parent
      }

      this.$emit('focusChange', newFocus)
    }
  }
}
</script>
<template>
  <div class="self" :style="`top: ${top}px`">
    <div class="inner">
      <div v-for="(item, i) in navItems" :key="i" class="d-flex section justify-content-center" :class="{active: i < path.length}" @click="onClick(i)">
        {{item}}
      </div>
    </div>
  </div>
</template>
<style scoped>

.self {
  position: fixed;
  left: 0;
  display: flex;
  justify-content: center;
  z-index: 10;
  pointer-events: none;
}

@media only screen and (min-width: 701px) {
  .self {
    top: 0 !important;
    height: 100vh;
    flex-direction: column;
    left: 100px;
  }
}

@media only screen and (max-width: 700px) {
  .self {
    width: 100vw;
  }
}

.inner {
  margin: auto 0;
  pointer-events: auto;
}

.section {
  background: #247B7D;
  padding: 0.5em;
  border-radius: 5px;
  min-width: 200px;
  border: 1px solid #00AEB4;
  margin: 4px;
  filter: brightness(1.05);
  opacity: 0.95;
  cursor: pointer;
}

.section:hover {
  opacity: 1;
}

.active.section {
  background: #00AEB4;
}
</style>
