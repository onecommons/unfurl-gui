<script>
import {GlAvatar} from '@gitlab/ui'
export default {
    name: 'BreadcrumbAvatar',
    components: {GlAvatar},
    props: {
        size: {
            type: Number,
            default: 16
        },
    },
    data() {
        // we want to always use the dashboard for the current project
        // return {src: window.gon.current_user_avatar_url}

        return {src: document.querySelector('.project-avatar').src}
    }
}

</script>
<template>
    <div class="m-1 d-flex align-items-center">
        <gl-avatar :size="size" :src="src" />
    </div>
</template>
