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
        return {src: window.gon.current_user_avatar_url}
    }
}

</script>
<template>
    <div class="m-1 d-flex align-items-center">
        <gl-avatar :size="size" :src="src" />
    </div>
</template>
