<script>
import {mapGetters} from 'vuex'
export default {
    name: 'EnvironmentTooltip',
    f: null,
    data() {
        return {...this.$options.f(), OPEN_BRACKET: '${', CLOSE_BRACKET: '}'}
    },
    computed: {
        ...mapGetters(['getDeploymentTemplate']),
        environmentVariableNames() {
            const result = this.getDeploymentTemplate?.environmentVariableNames
            return Array.isArray(result)? result: []
        },
    },
    created() {
        Object.assign(this, this.$options.f())
    }
}
</script>
<template>
    <div v-if="environmentVariableNames.length > 0" style="max-width: 300px;">
        <p>Use <code>${}</code> expressions to create dynamic environment variables.</p>
        <p>
            For example the key <code>PUBLIC_URL</code> and the value <code>{{OPEN_BRACKET}}APP_URL{{CLOSE_BRACKET}}</code> would make an environment variable <code>PUBLIC_URL</code> available to your application.
        </p>
        <div>
            The following environment variables can be made available to your application:
            <div style="max-height: 50vh; overflow: auto;">
                <ul class="mt-1" style="margin-left: -20px;">
                    <li v-for="variableName in environmentVariableNames" :key="variableName"> {{variableName}} </li>
                </ul>
            </div>
        </div>
    </div>
    <div v-else>
        Add environment variables for your deployment.
    </div>
</template>
