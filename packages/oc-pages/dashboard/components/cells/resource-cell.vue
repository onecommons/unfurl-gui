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
        <div style="margin-bottom: -2px;">{{resource.title}}</div>
    </div>
</template>
<style scoped>
.status-item {
    display: flex;
    align-items: center;
}
</style>
