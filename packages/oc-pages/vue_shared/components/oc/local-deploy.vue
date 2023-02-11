<script>
import CodeClipboard from './code-clipboard.vue'
import {GlLoadingIcon} from '@gitlab/ui'
import {mapGetters, mapActions} from 'vuex'
import {cloneProject, cloneBlueprint} from 'oc/vue_shared/client_utils/unfurl-invocations'
import {toDepTokenEnvKey} from 'oc/vue_shared/client_utils/envvars'
import {fetchProjectInfo} from 'oc/vue_shared/client_utils/projects'

const protocol = window.location.protocol
let server  = window.location.hostname
if(window.location.port) {
    server = server + ':' + window.location.port
}


export default {
    name: 'LocalDeploy',
    components: {
        CodeClipboard,
        GlLoadingIcon
    },
    data() {
        return {
            blueprintProjectInfo: null,
            gettingBlueprintCreds: false,
            gettingBlueprintInfo: true,
        }
    },
    props: {
        environment: Object,
        deployment: Object,
        projectId: {
            type: [String, Number],
            default: () => window.gon.projectId
        }
    },
    computed: {
        ...mapGetters([
            'getUsername',
            'getHomeProjectPath',
            'lookupVariableByEnvironment',
            'lookupDeployPath'
        ]),
        blueprintCredentials() {
            const empty = {username: null, password: null}
            if(!this.blueprintProjectInfo) return empty
            if(this.blueprintProjectInfo.visibility == 'public') return empty

            const username = `UNFURL_DEPLOY_TOKEN_${this.projectId}`
            const password = this.lookupVariableByEnvironment(
                toDepTokenEnvKey(this.blueprintProjectInfo.id),
                '*'
            )

            return {username, password}
        },
        blueprintUrl() {
            let result = `${protocol}//${server}/${this.deployment.projectPath}`

            const {username, password} = this.blueprintCredentials
            if(!(username && password)) {
                return result
            }

            result = new URL(result)
            result.username = username
            result.password = password

            return result.toString()
        },
        _localCloneOptions() {
            const username = this.getUsername
            const token = this.lookupVariableByEnvironment('UNFURL_PROJECT_TOKEN', '*')
            const projectPath = this.getHomeProjectPath
            const projectId = this.projectId
            const projectName = this.getHomeProjectPath.split('/').pop()            
            const deploymentName = this.deployment.name
            const environmentName = this.environment.name
            const deployPath = this.lookupDeployPath(deploymentName, environmentName)?.name
            const blueprint = this.deployment.blueprint
            const blueprintUrl = this.blueprintUrl
            return { protocol, username, token, server, projectName, projectPath, projectId, environmentName, deploymentName, deployPath, blueprint, blueprintUrl }
        },
        localCreateDeploymentInvocation() {
            return cloneBlueprint(this._localCloneOptions)
        },
        localCloneInvocation() {
            return cloneProject(this._localCloneOptions)
        },
        localDeployInvocation() {
            const projectName = this.getHomeProjectPath.split('/').pop()
            const deploymentName = this.deployment.name
            const environmentName = this.environment.name
            const deployPath = this.lookupDeployPath(deploymentName, environmentName)?.name
            return `unfurl deploy --commit ${deployPath} --use-environment ${environmentName}`
        },
        deploymentExists() { return this.deployment.__typename != 'DeploymentTemplate' }
    },
    methods: {
        ...mapActions(['tryFetchEnvironmentVariables', 'deployInto'])
    },
    watch: {
        blueprintCredentials: {
            immediate: true,
            async handler(val) {
                if(!val) return
                const {username, password} = val

                if(username && !password) {
                    // we don't have a deploy token for this blueprint

                    this.gettingBlueprintCreds = true
                    
                    const environmentName = this.environment.name
                    const deploymentName = this.deployment.name

                    const params = {
                        environmentName,
                        projectUrl: `${window.gon.gitlab_url}/${this.deployment.projectPath}.git`,
                        deployPath: `environments/${environmentName}/${this.deployment.projectPath}/${deploymentName}`,
                        deploymentName,
                        deploymentBlueprint: this.deployment.source,
                        deployOptions: {
                            schedule: 'defer'
                        }
                    }

                    const result = await this.deployInto(params)

                    await this.tryFetchEnvironmentVariables({fullPath: this.getHomeProjectPath})

                    this.gettingBlueprintCreds = false
                }
            }
        }

    },

    async created() {
        try {
            this.blueprintProjectInfo = await fetchProjectInfo(encodeURIComponent(this.deployment.projectPath))
        } catch(e) {throw e}
        finally {
            this.gettingBlueprintInfo = false
        }
    }

}

</script>
<template>
    <div>
        <gl-loading-icon v-if="this.gettingBlueprintInfo" label="Loading" size="lg" style="margin-top: 5em;" />
        <div v-else>
            <p>Run these shell commands to deploy this on your local machine:</p>
            <p>
                Install Unfurl if needed:
                <code-clipboard class="mt-1">python -m pip install -U unfurl</code-clipboard>
            </p>
            <p >
                Clone this Unfurl project if you haven't already:
                <code-clipboard class="mt-1">{{localCloneInvocation}}</code-clipboard>
                (Or if you have, run "git pull" to get latest.)
            </p>
            <p>
                Deploy the blueprint:
                <code-clipboard class="mt-1">cd dashboard; {{localDeployInvocation}}</code-clipboard>
            </p>
            <p>Learn more at <a href="https://github.com/onecommons/unfurl" target="_blank">https://github.com/onecommons/unfurl</a>.</p>
        </div>
    </div>
</template>
