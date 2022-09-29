<script>
import { mapGetters, mapActions } from 'vuex'
import { GlToggle } from '@gitlab/ui'

const UNFURL_PROJECT_SUBSCRIPTIONS = 'UNFURL_PROJECT_SUBSCRIPTIONS'

export default {
    name: 'IncrementalDeploymentSwitch',
    components: {
        GlToggle
    },
    props: {
        card: Object
        //resourceName: String,
        //upstreamProject: String,
    },
    watch: {
        async incrementalDeploymentEnabled(val) {
            console.log('watcher')
            await this.updateProjectSubscription({
                projectPath: this.upstreamProject,
                op: val? 'inc': 'dec'
            })
            
        }
    },
    methods: {
        //async updateProjectSubscription({rootGetters}, {projectPath, op}) {
        ...mapActions(['setEnvironmentVariable', 'updateProjectSubscription']),
    },
    computed: {
        ...mapGetters(['lookupVariableByEnvironment', 'getDeploymentTemplate', 'getCurrentEnvironment']),
        subscriptionsDict() {
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
        upstreamProject() {
            return this.card.properties.find(prop => prop.name == 'project_id')?.value
        },
        incrementalDeploymentEnabled: {
            get() {
                const dict = this.subscriptionsDict
                const subscriptions = dict?.subscriptions

                if(!(subscriptions && subscriptions[this.upstreamProject])) return false

                return subscriptions[this.upstreamProject]
                    .some(({deploymentName, resourceName, environmentName}) => (
                        deploymentName == this.deploymentName &&
                        resourceName == this.resourceName &&
                        environmentName == this.environmentName
                    ))
            },

            set(enabled) {
                const dict = this.subscriptionsDict
                const subscriptions = dict?.subscriptions || {}
                if (!subscriptions[this.upstreamProject]) subscriptions[this.upstreamProject] = []

                if(enabled) {
                    const {deploymentName, resourceName, environmentName} = this
                    subscriptions[this.upstreamProject].push({deploymentName, resourceName, environmentName})
                } else {
                    subscriptions[this.upstreamProject] = subscriptions[this.upstreamProject]
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
}
</script>
<template>
    <gl-toggle labelPosition="hidden" help="Automatically sync this resource with upstream" label="Automatically update this resource with upstream" v-model="incrementalDeploymentEnabled" />
</template>
