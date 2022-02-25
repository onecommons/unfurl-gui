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
    <router-link v-if="application && application.name" :to="{name: routes.OC_DASHBOARD_APPLICATIONS, params: {name: application.name}}">
        <div class="status-item">
            <project-icon :projectIcon="application.projectIcon" />
            {{application.title}}
        </div>
    </router-link>

</template>
<style scoped>
.status-item {
    display: flex;
    align-items: flex-end;
}
</style>
