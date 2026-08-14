<script>
import MarkdownView from 'oc_vue_shared/components/oc/markdown-view.vue'
import DetectIcon from 'oc_vue_shared/components/oc/detect-icon.vue'

export default {
  name: 'ResourceType',
  props: {
    item: Object
  },
  computed: {
    sourceUrl() {
      return this.item?.data?._sourceinfo?.url
    },

    detailsUrl() {
      return this.item?.data?.details_url
    },

    title() {
      return this.item?.data?.title
    },

    icon() {
      return this.item?.data?.icon
    },

    description() {
      return this.item?.data?.description || ''
    },

    components() {
      return this.item?.data?.metadata?.components || []
    },
  },
  components: {
    MarkdownView,
    DetectIcon
  },
}
</script>
<template>
  <div class="d-flex flex-column">
    <div class="d-flex align-items-center">
      <div class="d-flex align-items-center justify-content-center" style="width: 28px; height: 28px; background: white; border-radius: 50%;">
        <detect-icon :type="item.data" no-invert :size="20"/>
      </div>
      <!-- <img style="width: 1.25em; height: 1.25em; border-radius: 0.75em;" :src="icon"> -->
      <h6 class="ml-1" style="max-width: 365px">{{title}}</h6>
    </div>
    <a v-if="detailsUrl" target="_blank" :href="detailsUrl">View Documentation</a>
    <a v-else-if="sourceUrl" target="_blank" :href="sourceUrl">View Project</a>
    <div style="max-width: 400px; max-height: 250px; overflow-y: auto; word-break: break-word;" class="mt-1 mb-1">
      <markdown-view style="max-width: 100%;" v-if="description" :content="description" />
    </div>
    <div v-if="components.length > 0">
      <b>Components:</b>
      <div>
        <span class="d-flex ml-1" :key="component.name" v-for="component in components">{{component.title}}<detect-icon class="m-1" :type="component"/></span>
      </div>
    </div>
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
