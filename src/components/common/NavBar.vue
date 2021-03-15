<template>
  <div class="container-fluid">
    <div class="row">
      <gl-breadcrumb :items="items">
        <template #separator>
          <svg viewBox="0 0 16 16">
            <path
              d="M9.9 8.064L5.656 3.821A1 1 0 0 1 7.07 2.407l4.95 4.95a1 1 0 0 1 0 1.414l-4.95 4.95a1 1 0 0 1-1.414-1.414l4.242-4.243z"
              fill-rule="evenodd"
            />
          </svg>
        </template>
      </gl-breadcrumb>
    </div>
  </div>
</template>
<script lang="ts">
import { GlBreadcrumb } from "@gitlab/ui";
import { Component, Vue } from "vue-property-decorator";

@Component({
  components: {
    GlBreadcrumb
  }
})
export default class NavBar extends Vue {
  data() {
    return {
      items: [
        {
          text: "Home",
          to: { name: "Home" },
          active: true
        },
        {
          text: "Table",
          to: { name: "Table" }
        }
      ]
    };
  }
}
</script>
<style scoped>
/* Some css */
</style>
