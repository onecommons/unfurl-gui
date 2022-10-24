<script>
import CodeClipboard from './code-clipboard.vue'
import {mapGetters} from 'vuex'
import {cloneProject, cloneBlueprint} from 'oc_vue_shared/client_utils/unfurl-invocations'


export default {
    name: 'LocalDeploy',
    components: {
        CodeClipboard
    },
    props: {
        environment: Object,
        deployment: Object,
    },
    computed: {
        ...mapGetters([
            'getUsername',
            'getHomeProjectPath',
            'lookupVariableByEnvironment',
            'lookupDeployPath'
        ]),
        _localCloneOptions() {
            const protocol = window.location.protocol
            const username = this.getUsername
            const token = this.lookupVariableByEnvironment('UNFURL_ACCESS_TOKEN', '*')
            let server  = window.location.hostname
            if(window.location.port) {
                server = server + ':' + window.location.port
            }
            const projectPath = this.getHomeProjectPath
            const projectId = window.gon.projectId // TODO fix gon.projectId hack
            const projectName = this.getHomeProjectPath.split('/').pop()            
            const deploymentName = this.deployment.name
            const environmentName = this.environment.name
            const deployPath = this.lookupDeployPath(deploymentName, environmentName)?.name
            const blueprint = this.deployment.blueprint
            const blueprintUrl = `${protocol}//${username}:${token}@${server}/${this.deployment.projectPath}`
            return { protocol, username, token, server, projectName, projectPath, projectId, environmentName, deploymentName, deployPath, blueprint, blueprintUrl }
        },
        localCreateDeploymentInvocation() {
            return cloneBlueprint(this._localCloneOptions())
        },
        localCloneInvocation() {
            return cloneProject(this._localCloneOptions())
        },
        localDeployInvocation() {
            const projectName = this.getHomeProjectPath.split('/').pop()
            const deploymentName = this.deployment.name
            const environmentName = this.environment.name
            const deployPath = this.lookupDeployPath(deploymentName, environmentName)?.name
            return `cd ${projectName}; unfurl deploy ${deployPath} --use-environment ${environmentName} --commit`
        },
        deploymentExists() { return deployment.__typename != 'DeploymentTemplate' }
    }
}

</script>
<template>
    <div>
        <p>Run these shell commands to deploy this on your local machine:</p>
        <p>
            Install Unfurl if needed:
            <code-clipboard class="mt-1">python -m pip install -U unfurl</code-clipboard>
        </p>
        <p >
            Clone this Unfurl project if you haven't already:
            <code-clipboard class="mt-1">{{localCloneInvocation}}</code-clipboard>
        </p>
        <p v-if="!deploymentExists"> 
            Create the deployment from the blueprint.
            <code-clipboard class="mt-1">{{localCreateDeploymentInvocation}}</code-clipboard>
        </p>
        <p>
            Deploy the blueprint:
            <code-clipboard class="mt-1">{{localDeployInvocation}}</code-clipboard>
        </p>
        <p>Learn more at <a href="https://github.com/onecommons/unfurl" target="_blank">https://github.com/onecommons/unfurl</a>.</p>
    </div>
</template>
