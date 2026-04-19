<script>
import StatusIcon from 'oc_vue_shared/components/oc/Status.vue'
import {mapGetters} from 'vuex'
import {fetchDashboardProviders} from 'oc_vue_shared/client_utils/environments'

export default {
    name: 'EnvironmentStatus',
    data() {
        return {incompleteEnv: false}
    },
    props: {
        environment: Object
    },
    components: {StatusIcon},
    computed: {
        ...mapGetters(['getHomeProjectPath']),
        status() {
            // return this.scope.item.environment?.state == 'available'? 1: 3
            // TODO determine based on the status of whichever job ran with environment creation
            return this.incompleteEnv? 4: 1
        }
    },
    watch: {
        environment: {
            immediate: true,
            async handler() {
                if(!this.environment.primary_provider) {
                    try {
                        const providers = (await fetchDashboardProviders(this.getHomeProjectPath))
                            .providersByEnvironment[this.environment.name]

                        this.incompleteEnv = !!providers?.length
                    } catch(e) {} // error reported in environment-cell

                }
            }
        }
    }
}
</script>
<template>
<div class="w-100 d-flex justify-content-center">
    <StatusIcon :size="18" :status="status"/>
</div>
</template>
