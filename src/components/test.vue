<template>
  <gl-banner
    title="GitLab UI Banner Component"
    button-text="Just a test"
    button-link="https://gitlab.com"
    svg-path="https://gitlab.com/gitlab-org/gitlab-svgs/raw/master/illustrations/cluster_popover.svg"
    variant="introduction"
  >
    <p>
      This is a test of GitLab UI Component: Banner
    </p>
  </gl-banner>
</template>

<script>
import * as GlComponents from "@gitlab/ui";
export default {
  name: "formTest",
  components: {
    ...GlComponents
  }
};
</script>
