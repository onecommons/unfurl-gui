<script>
import * as routes from '../../router/constants'
import ProjectIcon from 'oc_vue_shared/components/oc/project-icon.vue'
export default {
    components: { ProjectIcon },
    props: {
        application: {
            type: Object,
            required: true
        },
    },
    data() {
        return {
            projectIconSrc: null,
        }
    },
    async created() {
        this.projectIconSrc = await this.application.projectIcon
    }
}
</script>
<template>
    <!-- TODO use router link when possible -->
    <a :href="`/${application.projectPath}`">
        <div v-if="application" class="status-item font-weight-bold">
            <project-icon :projectIcon="projectIconSrc" />
            {{application.title}}
        </div>
    </a>

</template>
<style scoped>
.status-item {
    display: flex;
    align-items: flex-end;
}
</style>
