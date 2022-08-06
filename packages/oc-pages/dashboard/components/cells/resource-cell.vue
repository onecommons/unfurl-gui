<script>
import * as routes from '../../router/constants'
import StatusIcon from 'oc_vue_shared/components/oc/Status.vue';
import {generateCardId} from 'oc_vue_shared/util.mjs'
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
            let consoleUrl
            /*
            * use consoleUrl
            if(this.resource.status != 5 && (consoleUrl = this.resource.attributes?.find(a => a.name == 'console_url')?.value)) {
                return {href: consoleUrl}
            }
             */
            const href = this.noRouter?
                `/dashboard/deployments/${this.environment.name}/${this.deployment.name}#${this.id}`: // TODO use from routes.js
                {name: routes.OC_DASHBOARD_DEPLOYMENTS, params: {name: this.deployment.name, environment: this.environment.name}, hash: `#${this.id}`}
            return this.noRouter? {href}: {to: href}
        },
    }
}
</script>
<template>
    <component :is="to.to? 'router-link': 'a'" v-bind="to">
        <div v-if="resource" class="status-item">
            <status-icon :size="16" :status="resource.status" :isProtected="resource['protected']" class="mr-1"/>
            <div style="line-height: 0">{{resource.title}}</div>
        </div>
    </component>
</template>
<style scoped>
.status-item {
    display: flex;
    align-items: center;
}
</style>
