<script>
import CodeClipboard from './code-clipboard.vue'
import {GlLoadingIcon} from '@gitlab/ui'
import {mapGetters, mapActions} from 'vuex'
import {cloneProject, cloneBlueprint} from 'oc_vue_shared/client_utils/unfurl-invocations'
import {toDepTokenEnvKey} from 'oc_vue_shared/client_utils/envvars'
import {fetchProjectInfo} from 'oc_vue_shared/client_utils/projects'

const protocol = window.location.protocol
let server  = window.location.hostname
if(window.location.port) {
    server = server + ':' + window.location.port
}

const EMPTY = Object.freeze({username: null, password: null})
const standalone = window.gon.unfurl_gui

export default {
    name: 'LocalDeploy',
    components: {
        CodeClipboard,
        GlLoadingIcon
    },
    props: {
        environment: Object,
        deployment: Object,
        teardown: Boolean,
        projectId: {
            type: [String, Number],
            default: () => window.gon.projectId
        },
        instruction: {
            default: 'Run these shell commands to deploy this on your local machine:',
            type: String
        }

    },
    data() {
        return {
            blueprintProjectInfo: null,
            gettingBlueprintCreds: false,
            gettingBlueprintInfo: (this.deployment && this.environment),
            standalone,
        }
    },
    computed: {
        ...mapGetters([
            'getUsername',
            'getHomeProjectName',
            'getHomeProjectPath',
            'lookupVariableByEnvironment',
            'lookupDeployPath',
            'deploymentItemDirect'
        ]),
        deployPath() {
            const deploymentName = this.deployment?.name
            const environmentName = this.environment?.name
            try {
                return this.lookupDeployPath(deploymentName, environmentName)
            } catch(e) {
                console.error(e)
                return null
            }
        },
        blueprintCredentials() {
            if(standalone) return EMPTY
            if(!this.blueprintProjectInfo) return EMPTY
            if(this.blueprintProjectInfo.visibility == 'public') return EMPTY

            const username = `UNFURL_DEPLOY_TOKEN_${this.projectId}`
            const password = this.lookupVariableByEnvironment(
                toDepTokenEnvKey(this.blueprintProjectInfo.id),
                '*'
            )

            return {username, password}
        },
        blueprintUrl() {
            let result = `${protocol}//${server}/${this.deployment?.projectPath}`

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
            const deploymentName = this.deployment?.name
            const environmentName = this.environment?.name
            const deployPath = this.deployPath?.name
            const blueprint = this.deployment?.blueprint
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
            const deployment = this.deployment
            const environment = this.environment
            const deploymentName = deployment.name

            // attempting to make this consistent for autostop
            // this may or not make sense for local deploy?
            const deploymentItem = this.deploymentItemDirect({deployment, environment})

            const extraArgs = deploymentItem?.pipeline?.variables?.EXTRA_WORKFLOW_ARGS || ''
            const subcommand = this.teardown? 'undeploy': 'deploy'
            const pushFlag = (standalone && !window.gon.gitlab_url)? '': '--push '
            return `unfurl ${subcommand}${extraArgs && ' ' + extraArgs} --commit ${pushFlag}${deploymentName}`
        },
        deploymentExists() { return this.deployment.__typename != 'DeploymentTemplate' },
        noDeploy() {
            return !(this.deployment && this.environment)
        },
        cdInstruction() {
            if(standalone) return ''
            return `cd ${this.getHomeProjectName}; `
        }
    },
    methods: {
        ...mapActions(['fetchEnvironmentVariables', 'deployInto'])
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
                        projectUrl: `${window.gon.gitlab_url}/${this.deployment?.projectPath}.git`,
                        deployPath: `environments/${environmentName}/${this.deployment?.projectPath}/${deploymentName}`,
                        deploymentName,
                        deploymentBlueprint: this.deployment.source,
                        deployOptions: {
                            schedule: 'defer'
                        }
                    }

                    const _result = await this.deployInto(params)

                    await this.fetchEnvironmentVariables({fullPath: this.getHomeProjectPath})

                    this.gettingBlueprintCreds = false
                }
            }
        }

    },

    async created() {
        try {
            this.blueprintProjectInfo = await fetchProjectInfo(encodeURIComponent(this.deployment?.projectPath))
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
            <p v-if="instruction">{{instruction}}</p>
            <p v-if="!standalone">
                Install Unfurl if needed:
                <code-clipboard class="mt-1">python -m pip install -U unfurl[full]</code-clipboard>
            </p>
            <p v-if="!standalone">
                Clone this Unfurl project if you haven't already:
                <code-clipboard class="mt-1">{{localCloneInvocation}}</code-clipboard>
                (Or if you have, run <code>git pull</code> to get latest.)
            </p>
            <p v-if="!noDeploy">
                Deploy the blueprint:
                <code-clipboard class="mt-1">{{cdInstruction}}{{localDeployInvocation}}</code-clipboard>
            </p>
            <p>Learn more at <a href="https://github.com/onecommons/unfurl" target="_blank">https://github.com/onecommons/unfurl</a>.</p>
        </div>
    </div>
</template>
