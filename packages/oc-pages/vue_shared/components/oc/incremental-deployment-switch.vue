<script lang="ts">
import {defineComponent} from 'vue'
import { mapGetters, mapActions } from 'vuex'
import { GlToggle } from '@gitlab/ui'

const UNFURL_PROJECT_SUBSCRIPTIONS = 'UNFURL_PROJECT_SUBSCRIPTIONS'

interface Subscription {deploymentName: string, resourceName: string, environmentName: string}
interface SubscriptionsDict {subscriptions?: Record<string, Subscription[]>, [key: string]: unknown}

export default defineComponent({
    name: 'IncrementalDeploymentSwitch',
    components: {
        GlToggle
    },
    props: {
        card: {type: Object, required: true},
        //resourceName: String,
        //upstreamProject: String,
    },
    watch: {
        async incrementalDeploymentEnabled(val) {
            await this.updateProjectSubscription({
                projectPath: this.upstreamProject,
                op: val? 'inc': 'dec'
            })
            
        }
    },
    methods: {
        ...mapActions(['setEnvironmentVariable', 'updateProjectSubscription']),
    },
    computed: {
        ...mapGetters(['lookupVariableByEnvironment', 'getDeploymentTemplate', 'getCurrentEnvironment', 'resolveResourceTemplate']),
        subscriptionsDict(): SubscriptionsDict {
            try {
                return JSON.parse(this.lookupVariableByEnvironment(UNFURL_PROJECT_SUBSCRIPTIONS, '*')) || {}
            } catch(e) {
                return {}
            }

        },
        resourceName() {
            return this.card.name
        },
        deploymentName() {
            return this.getDeploymentTemplate.name
        },
        environmentName() {
            return this.getCurrentEnvironment.name
        },
        // every container image source writes project_id, the GitHub-mirrored
        // one included (from its import)
        upstreamProject(): string | undefined {
            let template
            if(this.card.__typename == 'ResourceTemplate') {
                template = this.card
            } else if(typeof this.card.template == 'string') {
                template = this.resolveResourceTemplate(this.card.template)
            } else if(this.card.template) {
                template = this.card.template
            }

            return template?.properties?.find((prop: {name: string}) => prop.name == 'project_id')?.value?.toLowerCase()
        },
        incrementalDeploymentEnabled: {
            get() {
                const dict = this.subscriptionsDict
                const subscriptions = dict?.subscriptions

                const projectSubscriptions = subscriptions?.[String(this.upstreamProject)]
                if(!projectSubscriptions) return false

                return projectSubscriptions
                    .some(({deploymentName, resourceName, environmentName}) => (
                        deploymentName == this.deploymentName &&
                        resourceName == this.resourceName &&
                        environmentName == this.environmentName
                    ))
            },

            set(enabled: boolean) {
                const dict = this.subscriptionsDict
                const subscriptions = dict?.subscriptions || {}
                // String(): the object key an undefined project always became
                const key = String(this.upstreamProject)
                if (!subscriptions[key]) subscriptions[key] = []

                if(enabled) {
                    const {deploymentName, resourceName, environmentName} = this
                    subscriptions[key].push({deploymentName, resourceName, environmentName})
                } else {
                    subscriptions[key] = subscriptions[key]
                        .filter(({deploymentName, resourceName, environmentName}) => !(
                            deploymentName == this.deploymentName &&
                            resourceName == this.resourceName &&
                            environmentName == this.environmentName
                        ))
                }

                dict.subscriptions = subscriptions
                this.setEnvironmentVariable({
                    environmentName: '*',
                    variableName: UNFURL_PROJECT_SUBSCRIPTIONS,
                    variableValue: JSON.stringify(dict)
                })
            }
        }
    }
})
</script>
<template>
    <gl-toggle labelPosition="hidden" help="Automatically sync this resource with upstream" label="Automatically update this resource with upstream" v-model="incrementalDeploymentEnabled" />
</template>
