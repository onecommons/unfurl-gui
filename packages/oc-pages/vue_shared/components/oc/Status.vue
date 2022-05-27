<template>
  <div class="d-inline-flex align-items-center justify-content-center">
    <div v-if="status < StatusIndicators.length" class="gl-badge" :class="hackyBadgeClass" :style="{height: `${size}px`}">
      <!-- 
        standard gl-icon doesn't support variants
        standard gl-badge doesn't have good adequate control
        normally just gl-icon would be enough with proper variants
      -->
      <gl-icon
        v-if="!noTooltip"
        :variant="StatusIndicators[status][0]"
        :name="StatusIndicators[status][1]"
        class="status-icon"
        :size="size"
        :title="__(StatusIndicators[status][2])"
        v-gl-tooltip.hover
      />
      <gl-icon v-else
        :variant="StatusIndicators[status][0]"
        :name="StatusIndicators[status][1]"
        class="status-icon"
        :size="size"
        :title="__(StatusIndicators[status][2])"
      />
    </div>
    <div v-if="text || displayText" class="ml-1">{{__(StatusIndicators[status][2])}}</div>
    <!-- ignoring state for now -->
    <!--div v-if="state == 5">
      {{__(StateNames[state])}}
      <div style="position: relative; display: inline-block; height: 100%;">
        <svg class="spinner" viewBox="0 0 50 50">
          <circle class="path" cx="25" cy="25" r="20" fill="none" stroke="black" stroke-width="5"></circle>
        </svg>
      </div>
    </div>
    <div v-else-if="StateNames[state]">{{__(StateNames[state])}}</div-->
  </div>
</template>
<script>
import { GlIcon } from '@gitlab/ui';

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

const StateNames = [
  'Initial',
  'Creating',
  'Created',
  'Configuring',
  'Configured',
  'Starting',
  'Started',
  'Stopping',
  'Stopped',
  'Deleting',
  'Deleted',
  'Error'
]

export default {
  name: "Status",
  props: {
    status: Number,
    size: {
      type: Number,
      default: 12
    },
    text: {
      type: Boolean,
      default: false
    },
    displayText: Boolean, // alias for text
    state: {
      type: Number,
      default: -1
    },
    noTooltip: Boolean

  },
  data() {
    return { StatusIndicators, StateNames};
  },
  computed: {
    hackyBadgeClass() {
      const result = {}
      try {
        result[`badge-${StatusIndicators[this.status][0]}`] = true
      } catch(e) {}

      return result
    }
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
.gl-badge {
  border-radius: 100%;
  padding: 0;
}


/*
 * Copyright Fabio Ottaviani https://codepen.io/supah/pen/BjYLdW
 * modifications made
*/
.spinner {
  /*animation: rotate 2s linear infinite;*/
  width: 1.25em; height: 1.25em;
  margin: 0 0.25em;
}
.spinner > .path {
  stroke: hsl(210, 70, 75);
  stroke-linecap: round;
  animation: dash 1.5s ease-in-out infinite;
}

@keyframes rotate {
  100% {
    transform: rotate(360deg);
  }
}

@keyframes dash {
  0% {
    stroke-dasharray: 1, 150;
    stroke-dashoffset: 0;
  }
  50% {
    stroke-dasharray: 90, 150;
    stroke-dashoffset: -35;
  }
  100% {
    stroke-dasharray: 90, 150;
    stroke-dashoffset: -124;
  }
}
</style>
