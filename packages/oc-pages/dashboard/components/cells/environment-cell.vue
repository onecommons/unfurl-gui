<script>
import * as routes from '../../router/constants'
import {mapGetters, mapMutations} from 'vuex'
import {DetectIcon} from 'oc_vue_shared/components/oc'
import {fetchDashboardProviders} from 'oc_vue_shared/client_utils/environments'
export default {
    components: { DetectIcon },
    props: {
        environment: Object,
        noRouter: {type: Boolean, default: false}
    },
    data() {
        return {routes, recordedPrimaryProvider: null}
    },
    computed: {
        ...mapGetters(['getHomeProjectPath']),
        destination() {
            return this.noRouter ?
                {href: `/${this.getHomeProjectPath}/-/environments/${this.$props?.environment?.name}`} :
                this.$router.resolve({name: routes.OC_DASHBOARD_ENVIRONMENTS, params: {name: this.$props?.environment?.name}})
        },
        primaryProvider() {
            return this.environment.primary_provider?.type || this.recordedPrimaryProvider
        }
    },
    methods: {
        ...mapMutations(['createError'])
    },
    watch: {
        environment: {
            immediate: true,
            async handler() {
                if(!this.environment.primary_provider) {
                    let providers
                    try {
                        providers = (await fetchDashboardProviders(this.getHomeProjectPath))
                            .providersByEnvironment[this.environment.name]
                    } catch(e) {
                        if(!window.gon.unfurl_gui)
                            this.createError({
                                message: `Your environment is missing information: ${e.message}`,
                                context: {
                                    environment: this.environment.name,
                                },
                                severity: 'major'
                            })
                    }

                    try {
                        this.recordedPrimaryProvider = providers[0]
                    } catch(e) {}
                }
            }
        }
    }
}
</script>
<template>
    <a v-if="environment" :href="destination.href">
        <div class="status-item font-weight-bold">
            <detect-icon :size="20" v-if="primaryProvider" :type="primaryProvider"/>
            <div class="ml-1">{{environment.name}}</div>
        </div>
    </a>
</template>
<style scoped>
.status-item {
    display: flex;
    align-items: center;
}
</style>
