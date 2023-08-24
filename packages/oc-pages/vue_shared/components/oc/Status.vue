<template>
  <div class="d-inline-flex align-items-center justify-content-center status-container">
    <component v-if="status !== undefined" :is="badgeComponent" size="md" class="gl-mr-3">
      <div v-if="status < StatusIndicators.length" class="icon-only gl-badge" :class="hackyBadgeClass" :style="{height: `${size}px`}">
        <!--
          standard gl-icon doesn't support variants
          standard gl-badge doesn't have good adequate control
          normally just gl-icon would be enough with proper variants
        -->
        <detect-icon
            v-if="!noTooltip"
            :variant="StatusIndicators[status][0]"
            :name="StatusIndicators[status][1]"
            class="status-icon"
            :class="iconClass"
            :size="size"
            :title="__(StatusIndicators[status][2])"
            v-gl-tooltip.hover
            />
        <detect-icon v-else
           :variant="StatusIndicators[status][0]"
           :name="StatusIndicators[status][1]"
           class="status-icon"
           :class="iconClass"
           :size="size"
           :title="__(StatusIndicators[status][2])"
           />
      </div>
    <div v-if="_displayText" class="ml-1">{{_text}}</div>
    </component>
    <component :is="badgeComponent" v-if="isProtected" size="md" :class="_displayText? 'gl-mr-3': ''">
      <detect-icon v-gl-tooltip.hover class="gl-ml-1" title="Protected" name="protected" :size="size" />
      <div v-if="_displayText" class="ml-1">Protected</div>
    </component>
    <import-link v-if="card" :card="card" />
  </div>
</template>
<script>
import { GlBadge } from '@gitlab/ui';
import DetectIcon from './detect-icon.vue'
import ImportLink from './import-link.vue'




const StatusIndicators = [
  // Unknown
  ["muted", "status_notfound", "Unknown"],
  // Ok
  ["success", "status_success_solid", "Ok"],
  // Degraded
  ["warning", "status_running", "Degraded"],
  // Error
  ["", "failed", "Error"],
  // Pending
  ["neutral", "status_preparing", "Pending"],
  // Absent
  ["", "absent", "Absent"]
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
    isProtected: {
      type: Boolean,
      default: false
    },
    iconClass: {
      type: Array,
      default: () => []
    },
    displayText: Boolean, // alias for text
    state: {
      type: Number,
      default: -1
    },
    noTooltip: Boolean,
    card: Object
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
    },
    _text() {
      if(!this.status) return null
      const result = StatusIndicators[this.status][2]
      if(result == 'Absent' && ['Deleting', 'Deleted', 'Error'].includes(StateNames[this.state])) return 'Deleted'
      return result
    },

    _displayText() {
      return this.text || this.displayText
    },

    badgeComponent() {
      if(this._displayText) {
        return GlBadge
      }
      return 'span'
    }

  },
  components: {
    DetectIcon,
    ImportLink,
    GlBadge
  }
};
</script>
<style scoped>
.status-container > :not(.badge) {
  display: contents;
}

.status-icon {
  /*TODO maybe add an option to support this*/
  /*padding: 4px !important;*/
  padding: 0px !important;
}
.gl-badge.icon-only {
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
