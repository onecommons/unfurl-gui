<template>
  <span class="gl-badge" :class="hackyBadgeClass" :style="{height: `${size}px`}">
    <!-- 
      standard gl-icon doesn't support variants
      standard gl-badge doesn't have good adequate control
      normally just gl-icon would be enough with proper variants
    -->
      <gl-icon
        v-if="status < StatusIndicators.length"
        :variant="StatusIndicators[status][0]"
        :name="StatusIndicators[status][1]"
        class="status-icon"
        :size="size"
        :title="__(StatusIndicators[status][2])"
        v-gl-tooltip.hover
        >
      </gl-icon>
  </span>
</template>
<script>
//import { BBadge } from 'bootstrap-vue'
import { GlIcon, GlTooltipDirective } from '@gitlab/ui';

const StatusIndicators = [
  // Unknown
  ["muted", "status_notfound", "Unknown"],
  // Ok
  ["success", "status_success_solid", "Ok"],
  // Degraded
  ["warning", "status_running", "Degraded"],
  // Error
  ["danger", "status_warning", "Error"],
  // Pending
  ["neutral", "status_preparing", "Pending"],
  // Absent
  ["info", "status_open", "Absent"]
]

export default {
  name: "Status",
  props: {
    status: Number,
    size: {
      type: Number,
      default: 12
    },
  },
  data() {
    const hackyBadgeClass = {}
    hackyBadgeClass[`badge-${StatusIndicators[this.$props.status][0]}`] = true
    return { StatusIndicators, hackyBadgeClass};
  },
  directives: {
    GlTooltip: GlTooltipDirective,
  },
  components: {
    GlIcon//, BBadge
  }
};
</script>
<style scoped>

.status-icon {
  /*TODO maybe add an option to support this*/
  /*padding: 4px !important;*/
  padding: 0px !important;
}
span {
  margin-right: 4px;
  margin-bottom: calc(0.5em - 3px);
  border-radius: 100%;
  padding: 0;
}
</style>
