import {toDepTokenEnvKey} from 'oc_vue_shared/client_utils/envvars'
import {fetchProjectInfo} from 'oc_vue_shared/client_utils/projects'

async function updateValue(propertyName) {
    if(!this.getStatus) {
        throw new Error('updateValue requires "this.getStatus" to be available')
    }

    if(!this.updateProperty) {
        throw new Error('updateValue requires "this.updateProperty" to be available as a mapped action')
    }


    if(!this.updateCardInputValidStatus) {
        throw new Error('updateValue requires "this.updateCardInputValidStatus" to be available as a mapped action')
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
}


// The project comboboxes emit on every keystroke, so a watcher on their value
// sees partial paths that match no project. Fetching those 404s once per
// character, and an unawaited rejection raises the dev server's error overlay.
async function isKnownProject(path) {
    if(!this.userProjectSuggestionsPromise) {
        throw new Error('isKnownProject requires "this.userProjectSuggestionsPromise" to be available')
    }

    const projects = await this.userProjectSuggestionsPromise.catch(() => [])

    return projects.some(project => project.path_with_namespace == path)
}


export const connectedRepo = {
    data() {
        return {username: undefined, password: undefined}
    },
    methods: {
        isKnownProject,

        async setupRegistryCredentials() {
            if(!this.projectInfo) {
                throw new Error('setupRegistryCredentials requires "this.projectInfo" to be available')
            }

            if(this.getHomeProjectPath == null) {
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

        updateValue
    },
    computed: {
        credentialsOk() {
            return this.projectInfo?.visibility == 'public' || (this.username && this.password)
        }
    }
}

export const hasUpdates = {
    methods: {
        updateValue
    }
}
