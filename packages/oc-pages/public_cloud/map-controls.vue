<script>
import {GlButton} from '@gitlab/ui'
import {Select as ElSelect, Option as ElOption} from 'element-ui'
export default {
  name: 'MapControls',
  components: {
    GlButton,
    ElSelect,
    ElOption
  },
  data() {
    const selected = location.search.includes('show=providers') ? 'Providers First': 'Categories First'
    return {selected}
  },
  watch: {
    selected(val) {
      if(val == 'Providers First') {
        location.search = 'show=providers'
      } else {
        location.search = ''
      }
    }
  }
}
</script>
<template>
  <div id="map-controls" class="map-controls-shell">
    <div class="map-controls-inner d-flex flex-wrap justify-content-end ml-5 mr-5" style="pointer-events: none;">
      <div class="d-flex flex-column align-items-end">
        <div class="d-flex flex-column zoom-buttons" style="width: 60px;">
          <gl-button data-testid="map-center" @click="$emit('center')" size="small" icon="maximize" />
          <gl-button data-testid="map-zoomin" @click="$emit('zoomin')" size="small" icon="plus" class="ml-0" />
          <gl-button data-testid="map-zoomout" @click="$emit('zoomout')" size="small" icon="dash" class="ml-0" />
        </div>
        <div class="d-flex zoom-buttons">
          <el-select data-testid="map-select" v-model="selected">
            <el-option label="Categories First" value="Categories First"/>
            <el-option label="Providers First" value="Providers First"/>
          </el-select>
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped>
.map-controls-shell {
  position: absolute;
  bottom: 1rem;
  right: 0;
  left: 0;
  z-index: 7;
  pointer-events: none;
}

.map-controls-inner {
  position: relative;
}

.zoom-buttons { pointer-events: all; }
.zoom-buttons >>> i { font-size: 1.5em; }
</style>
