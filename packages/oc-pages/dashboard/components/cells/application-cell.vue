<script>
import * as routes from '../../router/constants'
import {withApplicationLinkTarget} from './mixins'
import ProjectIcon from 'oc_vue_shared/components/oc/project-icon.vue'
export default {
    components: { ProjectIcon },
    mixins: [withApplicationLinkTarget],
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
    computed: {
        applicationLinkTarget() {
            if(!this.application.projectPath) return null
            if(window.gon.unfurl_gui) {
                return `/${this.application.projectPath}/-/overview`
            }
            return `/${this.application.projectPath}`
        }
    },
    async created() {
        this.projectIconSrc = await this.application.projectIcon
    }
}
</script>
<template>
    <!-- TODO use router link when possible -->
    <a :href="applicationLinkTarget">
        <div v-if="application" class="status-item font-weight-bold">
            <project-icon :projectIcon="projectIconSrc" />
            {{application.title}}
        </div>
    </a>

</template>
<style scoped>
.status-item {
    display: flex;
    align-items: center;
}
</style>
