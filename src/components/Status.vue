<template>
    <div>
        <gl-badge v-if="this.status=='unknown'" href="#" icon="status_notfound" variant="muted">unknown</gl-badge>
        <gl-badge v-if="this.status=='pending'" href="#" icon="status_preparing" variant="neutral">pending</gl-badge>
        <gl-badge v-if="this.status=='absent'" href="#" icon="status_open" variant="info">absent</gl-badge>
        <gl-badge v-if="this.status=='ok'" href="#" icon="status_success_solid" variant="success">ok</gl-badge>
        <gl-badge v-if="this.status=='error'" href="#" icon="status_warning" variant="danger">error</gl-badge>
        <gl-badge v-if="this.status=='degraded'" href="#" icon="status_running" variant="warning">degraded</gl-badge>
    </div>
</template>
<script>
import * as GlComponents from "@gitlab/ui";

export default {
    name: "Status",
    props: {
        status: String
    },
    components: {
        ...GlComponents,
    },
}
</script>
<style>

</style>