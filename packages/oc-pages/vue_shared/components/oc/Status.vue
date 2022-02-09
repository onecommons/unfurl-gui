<template>
  <div>
    <gl-badge
      v-if="status < StatusIndicators.length"
      :variant="StatusIndicators[status][0]"
      :icon="StatusIndicators[status][1]"
      class="status-icon"
      :title="__(StatusIndicators[status][2])"
      v-gl-tooltip.hover
    >
    </gl-badge>
  </div>
</template>
<script>
import { GlBadge, GlTooltipDirective } from '@gitlab/ui';

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
    status: Number
  },
  data() {
    return { StatusIndicators };
  },
  directives: {
    GlTooltip: GlTooltipDirective,
  },
  components: {
    GlBadge
  }
};
</script>
<style scoped>
.status-icon {
  padding: 4px !important;
}
</style>
