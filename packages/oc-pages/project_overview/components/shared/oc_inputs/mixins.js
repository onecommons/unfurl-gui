import {toDepTokenEnvKey} from 'oc_vue_shared/client_utils/envvars'
import {fetchProjectInfo} from 'oc_vue_shared/client_utils/projects'

export const connectedRepo = {
    data() {
        return {username: undefined, password: undefined}
    },
    methods: {
        async setupRegistryCredentials() {
            if(!this.projectInfo) {
                throw new Error('setupRegistryCredentials requires "this.projectInfo" to be available')
            }

            if(!this.getHomeProjectPath) {
                throw new Error(`setupRegistryCredentials requires "this.getHomeProjectPath" to be available as a mapped getter`)
            }

            const depToken = toDepTokenEnvKey(this.projectInfo.id)
            const dashboardProject = await fetchProjectInfo(encodeURIComponent(this.getHomeProjectPath))

            if(this.projectInfo.visibility == 'public') {
                this.username = this.password = null
            } else {
                this.username = `UNFURL_DEPLOY_TOKEN_${dashboardProject.id}`
                this.password = {get_env: depToken}
            }
            this.updateValue('username')
            this.updateValue('password')
        },

        async updateValue(propertyName) {
            if(!this.getStatus) {
                throw new Error('updateValue requires "this.getStatus" to be available')
            }

            if(!this.updateProperty) {
                throw new Error('updateValue requires "this.updateProperty" to be available as a mapped action')
            }


            let status = await this.getStatus()

            if (this.onUpdateValue) {
                status = await this.onUpdateValue() || status
            }

            this.updateCardInputValidStatus({card: this.card, status, debounce: 300})

            if(propertyName) {
                this.updateProperty({
                    deploymentName: this.$route.params.slug,
                    templateName: this.card.name,
                    propertyName,
                    propertyValue: this[propertyName],
                    debounce: 300,
                    sensitive: false,
                })
            }
        },
    }
}
