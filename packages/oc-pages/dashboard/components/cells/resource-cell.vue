<script>
//import * as routes from '../../router/constants'
import StatusIcon from '../../../vue_shared/components/oc/Status.vue';
export default {
    components: { StatusIcon },
    props: {
        resource: Object
    },
    data() {
        return {}
        //return {routes}
    }
}
</script>
<template>
    <div class="status-item">
        <status-icon :status="resource.status"/>
        {{resource.title}}
    </div>
</template>
<style scoped>
.status-item {
    display: flex;
    align-items: flex-end;
}
</style>
