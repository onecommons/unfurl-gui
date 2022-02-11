<template>
  <span>
    <!-- 
      standard gl-icon doesn't support variants
      standard gl-badge doesn't have good adequate control
      normally just gl-icon would be enough with proper variants
    -->
    <b-badge class="gl-badge status-icon" :variant="StatusIndicators[status][0]" >
      <gl-icon
        v-if="status < StatusIndicators.length"
        :variant="StatusIndicators[status][0]"
        :name="StatusIndicators[status][1]"
        class="status-icon"
        :size="12"
        :title="__(StatusIndicators[status][2])"
        v-gl-tooltip.hover
        >
      </gl-icon>
    </b-badge>
  </span>
</template>
<script>
import { BBadge } from 'bootstrap-vue'
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
    status: Number
  },
  data() {
    return { StatusIndicators };
  },
  directives: {
    GlTooltip: GlTooltipDirective,
  },
  components: {
    GlIcon, BBadge
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
  height: 12px;
  margin: calc(0.5em - 5px) 4px;
}
</style>
