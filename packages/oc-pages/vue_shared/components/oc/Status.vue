<template>
  <div>
    <gl-badge
      v-if="status in statusBadges"
      :variant="statusBadges[status][0]"
      :icon="statusBadges[status][1]"
      class="status-icon"
      :title="status[0].toUpperCase() + status.slice(1)"
      v-gl-tooltip.hover
    >
      <!--span>
        {{ status[0].toUpperCase() + status.slice(1) }}
      </span-->
    </gl-badge>
  </div>
</template>
<script>
import { GlBadge, GlTooltipDirective } from '@gitlab/ui';

export default {
  name: "Status",
  props: {
    status: String
  },
  data() {
    return {
      statusBadges: {
        // status: [variant, icon]
        unknown: ["muted", "status_notfound"],
        pending: ["neutral", "status_preparing"],
        absent: ["info", "status_open"],
        ok: ["success", "status_success_solid"],
        error: ["danger", "status_warning"],
        degraded: ["warning", "status_running"]
      }
    };
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
