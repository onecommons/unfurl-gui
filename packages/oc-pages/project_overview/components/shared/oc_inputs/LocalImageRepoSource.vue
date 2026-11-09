<script lang="ts">
import {defineComponent} from 'vue'
import {GlCard, GlFormGroup, GlFormInput} from '@gitlab/ui'
import SuggestionInput from './suggestion-input.vue'
import {fetchProjects, fetchRegistryRepositories, fetchContainerRepositories, fetchProjectInfo} from 'oc_vue_shared/client_utils/projects'
import {toDepTokenEnvKey} from 'oc_vue_shared/client_utils/envvars'
import {mapGetters, mapActions, mapMutations} from 'vuex'
import DeploymentScheduler from '../../../../vue_shared/components/oc/deployment-scheduler.vue'

import {connectedRepo} from './mixins'

interface Suggestion {value: string}
type SuggestionCallback = (suggestions: Suggestion[]) => void

function callbackFilter(query: string, items: Suggestion[]) {
    if(!query || items.some(item => item.value == query)) return items
    return items.filter(item => item.value.includes(query))
}

export default defineComponent({
    name: 'LocalImageRepoSource',
    components: {GlCard, GlFormGroup, GlFormInput, SuggestionInput, DeploymentScheduler},
    props: {
        card: {type: Object, required: true}
    },
    mixins: [connectedRepo],
    data() {
        const data: Record<string, any> = {
            userProjectSuggestionsPromise: fetchProjects({minAccessLevel: 10}),
            projectInfo: null,
            containerRepositoriesPromise: null,
            containerRepositories: [],
        }
        for(const prop of this.card.properties) {
            data[prop.name] = prop.value // expecting project_id, repository_id, repository_tag, registry_url (repository_tag has a default)
        }

        if(!data.repository_tag) {
            data.repository_tag = 'latest'
        }
        return data
    },
    computed: {
        ...mapGetters(['cardIsValid', 'getDeploymentTemplate', 'getHomeProjectPath'])
    },
    watch: {
        async project_id(val) {
            if(!val) {
                this.repository_id = null
            }
            this.updateValue('project_id')

            if(!val || !await this.isKnownProject(val)) return

            this.containerRepositoriesPromise = fetchContainerRepositories(val)
            this.projectInfo = await fetchProjectInfo(encodeURIComponent(val))
        },
        repository_id(val) {
            if(!val) {
                this.repository_tag = 'latest'
            }

            this.updateValue('repository_id')
            
            const containerRepository = this.containerRepositories.find((cr: {path: string}) => cr.path == val)
            if(!containerRepository) return

            // do I just guess this when containerRepository is missing?
            this.registry_url = containerRepository.location
                .slice(0, 0 - val.length)
                .split('/')
                .filter((pathComponent: string) => pathComponent)
                .join('/') // I don't know if the registry_url can include a path
                .toLowerCase()

            this.updateValue('registry_url')
        },
        repository_tag() {
            this.updateValue('repository_tag')
        },
        projectInfo() {
            this.setupRegistryCredentials()
        }
    },
    methods: {
        ...mapActions(['updateProperty', 'updateCardInputValidStatus']),
        ...mapMutations(['onDeploy', 'setUpstreamProject']),

        getStatus() {
            const status = this.credentialsOk && this.project_id && this.repository_id && this.repository_tag ?
                'valid': 'missing'
            return status
        },

        async getUserProjectSuggestions(queryString: string, callback: SuggestionCallback) {
            const projects = await this.userProjectSuggestionsPromise
            callback(
                callbackFilter(
                    queryString,
                    projects
                        .map((project: {path_with_namespace: string}) => ({value: project.path_with_namespace}))
                )
            )
        },
        async getRepositoryIdSuggestions(queryString: string, callback: SuggestionCallback) {
            if(!this.containerRepositoriesPromise) {
                this.containerRepositoriesPromise = fetchRegistryRepositories(encodeURIComponent(this.project_id))
            }
            const containerRepositories = this.containerRepositories = await this.containerRepositoriesPromise
            callback(
                callbackFilter(
                    queryString,
                    containerRepositories
                        .map((repo: {path: string}) => ({value: repo.path}))
                )
            )
        },
    },
    async mounted() {
        this.updateValue()

        this.onDeploy(async () => {
            if(this.cardIsValid(this.card)) {
                const projects = await this.userProjectSuggestionsPromise
                const projectId = projects.find((project: {path_with_namespace: string}) => project.path_with_namespace == this.project_id)?.id
                if(projectId) {
                    this.setUpstreamProject(projectId)
                }
            }
        })

        if(this.project_id) {
            this.projectInfo = await fetchProjectInfo(encodeURIComponent(this.project_id))
        }
    }
})
</script>
<template>
    <gl-card body-class="gl-flex gl-flex-col">
        <suggestion-input
            data-testid="oc-input-local-project"
            label="Local Project"
            style="width: min(500px, 100%)"
            v-model="project_id"
            :fetch-suggestions="getUserProjectSuggestions"/>
        <suggestion-input
            data-testid="oc-input-local-image"
            label="Container Image"
            style="width: min(500px, 100%)"
            v-if="project_id"
            v-model="repository_id"
            :fetch-suggestions="getRepositoryIdSuggestions"/>
        <!-- a label above, like the two comboboxes: an input-group addon here
             would be the only one in the card -->
        <gl-form-group v-if="project_id" label="Tag" style="width: min(300px, 100%)">
            <gl-form-input data-testid="oc-input-local-tag" v-model="repository_tag" type="text"/>
        </gl-form-group>

        <deployment-scheduler v-if="project_id" :deploymentName="getDeploymentTemplate.name" :resourceName="card.name" :upstreamProject="project_id"/>
    </gl-card>
</template>
<style scoped>
</style>
