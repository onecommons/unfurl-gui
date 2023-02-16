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
            // return this.scope.item.environment?.state == 'available'? 1: 3
            // TODO determine based on the status of whichever job ran with environment creation
            return 1
        }
    }
}
</script>
<template>
<div class="w-100 d-flex justify-content-center">
    <StatusIcon :size="18" :status="status"/>
</div>
</template>
