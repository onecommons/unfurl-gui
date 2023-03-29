<script>
import { mapGetters, mapActions } from 'vuex'
import { Checkbox as ElCheckbox} from 'element-ui'
import { DetectIcon } from 'oc_vue_shared/components/oc'

const UNFURL_PROJECT_SUBSCRIPTIONS = 'UNFURL_PROJECT_SUBSCRIPTIONS'

export default {
    name: 'DeploymentScheduler',
    components: {
        DetectIcon,
        ElCheckbox
    },
    props: {
        resourceName: String,
        upstreamProject: String,
        label: String
    },
    methods: {
        ...mapActions(['setEnvironmentVariable']),
    },
    computed: {
        ...mapGetters(['lookupVariableByEnvironment', 'getDeploymentTemplate', 'getCurrentEnvironment', 'getCurrentContext']),
        _upstreamProject() {
            return this.upstreamProject.toLowerCase()

        },
        subscriptionsDict() {
            try {
                return JSON.parse(this.lookupVariableByEnvironment(UNFURL_PROJECT_SUBSCRIPTIONS, '*')) || {}
            } catch(e) {
                return {}
            }

        },
        deploymentName() {
            return this.getDeploymentTemplate.name
        },
        environmentName() {
            return this.getCurrentEnvironment.name
        },
        _label() {
            return this.label || 'Redeploy every time upstream dependencies are updated'
        },
        incrementalDeploymentEnabled: {
            get() {
                const dict = this.subscriptionsDict
                const queued = dict?.queued

                if(!(queued && queued[this._upstreamProject])) return false

                return queued[this._upstreamProject]
                    .some(({deploymentName, resourceName, environmentName}) => (
                        deploymentName == this.deploymentName &&
                        resourceName == this.resourceName &&
                        environmentName == this.environmentName
                    ))
            },

            set(enabled) {
                const dict = this.subscriptionsDict
                const queued = dict?.queued || {}
                if (!queued[this._upstreamProject]) queued[this._upstreamProject] = []

                if(enabled) {
                    const {deploymentName, resourceName, environmentName} = this
                    queued[this._upstreamProject].push({deploymentName, resourceName, environmentName})
                } else {
                    queued[this._upstreamProject] = queued[this._upstreamProject]
                        .filter(({deploymentName, resourceName, environmentName}) => !(
                            deploymentName == this.deploymentName &&
                            resourceName == this.resourceName &&
                            environmentName == this.environmentName
                        ))
                }

                dict.queued = queued
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
        <div v-if="this.getCurrentContext != 'environment'" class="d-flex mt-5 p align-items-center">
            <detect-icon size="24" name="expire" />
            <div class="ml-5">
                <el-checkbox v-model="incrementalDeploymentEnabled" :label="_label"/>
            </div>
        </div>

</template>
