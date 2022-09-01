<script>
import CodeClipboard from './code-clipboard.vue'
import {mapGetters} from 'vuex'
import {cloneAlreadyDeployed, cloneForDraft} from 'oc_vue_shared/client_utils/unfurl-invocations'


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
        localCloneInvocation() {
            const protocol = window.location.protocol
            const username = this.getUsername
            const token = this.lookupVariableByEnvironment('UNFURL_ACCESS_TOKEN', '*')
            let server  = window.location.hostname
            if(!['80', '443'].includes(window.location.port)) {
                server = server + ':' + window.location.port
            }
            const projectPath = this.getHomeProjectPath
            const projectId = window.gon.projectId // TODO fix gon.projectId hack
            const deploymentName = this.deployment.name
            const environmentName = this.environment.name
            const deployPath = this.lookupDeployPath(deploymentName, environmentName)?.name
            const blueprint = this.deployment.blueprint
            const blueprintUrl = `${protocol}//${server}/${this.deployment.projectPath}`

            const options = {protocol, username, token, server, projectPath, projectId, environmentName, deploymentName, deployPath, blueprint, blueprintUrl}
            if(this.deployment.__typename == 'DeploymentTemplate') {
                return cloneForDraft(options)
            } else {
                return cloneAlreadyDeployed(options)
            }
        },
        localDeployInvocation() {
            const projectName = this.getHomeProjectPath.split('/').pop()
            const deploymentName = this.deployment.name
            const environmentName = this.environment.name
            const deployPath = this.lookupDeployPath(deploymentName, environmentName)?.name

            return `unfurl deploy ${projectName}/${deployPath} \\\n--use-environment ${environmentName} --commit`
        }
    }
}

</script>
<template>
    <div>
        <p>Run these shell commands to deploy this on your local machine:</p>
        <p>
            Install Unfurl:
            <code-clipboard class="mt-1">python -m pip install -U unfurl</code-clipboard>
        </p>
        <p>
            Clone from Unfurl.cloud:
            <code-clipboard class="mt-1">{{localCloneInvocation}}</code-clipboard>
        </p>
        <p>
            Deploy your application:
            <code-clipboard class="mt-1">{{localDeployInvocation}}</code-clipboard>
        </p>
        <p>Learn more at <a href="https://github.com/onecommons/unfurl" target="_blank">https://github.com/onecommons/unfurl</a>.</p>
    </div>
</template>
