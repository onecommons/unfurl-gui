<template>
  <div class="status-badge">
    <gl-badge
      v-if="status in statusBadges"
      href="javascript:void(0)"
      :variant="statusBadges[status][0]"
      :icon="statusBadges[status][1]"
    >
      <span>
        {{ status[0].toUpperCase() + status.slice(1) }}
      </span>
    </gl-badge>
  </div>
</template>
<script>
import * as GlComponents from "@gitlab/ui";

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
  components: {
    ...GlComponents
  }
};
</script>
<style scoped>
.status-badge * {
  cursor: default;
}
.status-badge span {
  padding: 0 0.3rem;
}
</style>
