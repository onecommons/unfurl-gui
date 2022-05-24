<script>
import StatusIcon from 'oc_vue_shared/components/oc/Status.vue'

export default {
    name: 'EnvironmentStatus',
    props: {
        scope: Object
    },
    components: {StatusIcon},
    computed: {
        status() {
            return this.scope.item.environment?.state == 'available'? 1: 3
        }
    }
}
</script>
<template>
<div class="w-100 d-flex justify-content-center">
    <StatusIcon :size="18" :status="status"/>
</div>
</template>
