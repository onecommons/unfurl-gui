<script>
import * as routes from '../../router/constants'
import StatusIcon from '../../../vue_shared/components/oc/Status.vue';
import {generateCardId} from '../../../vue_shared/util.mjs'
export default {
    components: { StatusIcon },
    props: {
        resource: Object, deployment: Object, environment: Object,
        noRouter: {
            type: Boolean,
            default: false
        }

    },
    data() {
        return {}
        //return {routes}
    },
    computed: {
        id() {
            return generateCardId(this.resource.name)
        },
        to() {
            const href = this.noRouter?
                `/dashboard/deployments/${this.environment.name}/${this.deployment.name}#${this.id}`: // TODO use from routes.js
                {name: routes.OC_DASHBOARD_DEPLOYMENTS, params: {name: this.deployment.name, environment: this.environment.name}, hash: `#${this.id}`}
            return this.noRouter? {href}: {to: href}
        }
    }
}
</script>
<template>
    <component :is="noRouter? 'a': 'router-link'" v-bind="to">
        <div class="status-item">
            <status-icon :status="resource.status"/>
            <div style="margin-bottom: -2px;">{{resource.title}}</div>
        </div>
    </component>
</template>
<style scoped>
.status-item {
    display: flex;
    align-items: center;
}
</style>
