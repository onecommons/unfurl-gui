<script>
import * as routes from '../../router/constants'
import ProjectIcon from '../../../vue_shared/components/oc/project-icon.vue'
export default {
    components: { ProjectIcon },
    props: {
        application: {
            type: Object,
            required: true
        },
    },
    data() {
        return {routes}
    }
}
</script>
<template>
    <!--router-link v-if="application && application.name" :to="{name: routes.OC_DASHBOARD_APPLICATIONS, params: {name: application.name}}"-->
    <a :href="`/${application.name}`">
        <div v-if="application" class="status-item font-weight-bold">
            <project-icon :projectIcon="application.projectIcon" />
            {{application.title}}
        </div>
    </a>
    <!--/router-link-->

</template>
<style scoped>
.status-item {
    display: flex;
    align-items: flex-end;
}
</style>
