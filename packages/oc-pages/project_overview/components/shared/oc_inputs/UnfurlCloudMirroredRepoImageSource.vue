<script lang="ts">
import {defineComponent} from 'vue'
import axios from '~/lib/utils/axios_utils'
import {mapActions, mapMutations, mapGetters} from 'vuex'
import {fetchProjects, fetchRepositoryBranches, fetchProjectInfo} from 'oc_vue_shared/client_utils/projects'
import type {Branch, ProjectInfo} from 'oc_vue_shared/client_utils/projects'
import DeploymentScheduler from '../../../../vue_shared/components/oc/deployment-scheduler.vue'
import {GlCard} from '@gitlab/ui'
import SuggestionInput from './suggestion-input.vue'

import {connectedRepo} from './mixins'

interface Suggestion {value: string}
type SuggestionCallback = (suggestions: Suggestion[]) => void

function callbackFilter(query: string, items: Suggestion[]) {
    if(!query || items.some(item => item.value == query)) return items
    return items.filter(item => item.value.includes(query))
}

export default defineComponent({
    name: 'UnfurlCloudMirroredRepoImageSource',
    props: {
        card: {type: Object, required: true},
        readonly: Boolean
    },
    components: {
        DeploymentScheduler,
        GlCard,
        SuggestionInput
    },
    mixins: [connectedRepo],
    data() {
        const data = {
            userProjectSuggestionsPromise: fetchProjects({minAccessLevel: 10}),
            // unset for a project the user cannot see
            repositoryBranchesPromise: null as Promise<Branch[]> | null,
            project_id: null as string | null,
            branch: null as string | null,
            repository_tag: null as string | null,
            projectInfo: null as ProjectInfo | null,
        }

        for(const {name, value} of this.card.properties) {
            if(data.hasOwnProperty(name)) {
                (data as Record<string, unknown>)[name] = value
            }
        }

        return data
    },
    methods: {
        ...mapActions(['updateProperty', 'updateCardInputValidStatus']),
        ...mapMutations(['onSaveEnvironment', 'setUpstreamProject', 'setUpstreamBranch', 'setUpstreamCommit']),
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
        async getBranchSuggestions(queryString: string, callback: SuggestionCallback) {
            const branches = await this.repositoryBranchesPromise ?? []
            callback(
                callbackFilter(
                    queryString,
                    branches
                        .map(branch => ({value: branch.name}))
                )
            )
        },

        getStatus() {
            const status = this.credentialsOk && this.project_id && this.repository_tag && this.registry_url && this.remote_git_url ?
                'valid': 'missing'
            return status
        }
    },
    computed: {
        ...mapGetters(['cardIsValid', 'getDeploymentTemplate', 'getHomeProjectPath']),
        registry_url() {
            if(this.projectInfo && this.project_id) {
                return (this.projectInfo.container_registry_image_prefix as string)
                    .slice(0, 0 - this.project_id.length)
                    .split('/')
                    .filter((pathComponent: string) => pathComponent)
                    .join('/') // I don't know if the registry_url can include a path
            }
            return null
        },

        remote_git_url() {
            return this.projectInfo?.web_url
        }
    },
    watch: {
        project_id: {
            immediate: true,
            async handler(val) {
                if(!val) {
                    this.branch = null
                    return
                }
                this.updateValue('project_id')

                if(!await this.isKnownProject(val)) return

                this.repositoryBranchesPromise = fetchRepositoryBranches(encodeURIComponent(val))
                const projectInfo = this.projectInfo = await fetchProjectInfo(encodeURIComponent(val))
                if(!projectInfo) return
                // async, so a try/catch around the call caught nothing
                this.setupRegistryCredentials().catch((e: unknown) => console.error('setupRegistryCredentials', e))

            }
        },
        branch(val) { this.updateValue('branch') },
        repository_tag(val) { this.updateValue('repository_tag') },
        registry_url(val) { this.updateValue('registry_url') },
        remote_git_url(val) { this.updateValue('remote_git_url') },
    },
    async mounted() {
        this.repository_tag = 'latest' // trigger watcher and prepare commit
        this.updateValue()

        this.onSaveEnvironment(async () => {
            // a valid card has a fetched project
            if(this.cardIsValid(this.card) && this.projectInfo) {
                const id = this.projectInfo.id
                const branch = this.branch || this.projectInfo.default_branch
                try {
                  const commits = (await axios.get(`/api/v4/projects/${id}/repository/commits?ref=${branch}`)).data
                  this.setUpstreamCommit(commits[0].id)
                } catch(e) {
                  console.error("couldn't find upstream commit")
                  console.error((e as Error).message)
                }
                this.setUpstreamProject(id)
                this.setUpstreamBranch(branch)
            }
        })

    }
})
</script>
<template>
    <gl-card body-class="gl-flex gl-flex-col">
        <suggestion-input
            data-testid="oc-input-uc-project"
            label="Local Project"
            style="width: min(500px, 100%)"
            v-model="project_id"
            :fetch-suggestions="getUserProjectSuggestions"
            :disabled="readonly"/>
        <suggestion-input
            data-testid="oc-input-uc-branch"
            label="Branch"
            style="width: min(500px, 100%)"
            v-if="project_id"
            v-model="branch"
            :fetch-suggestions="getBranchSuggestions"
            :disabled="readonly"/>
        <deployment-scheduler v-if="project_id" :deploymentName="getDeploymentTemplate.name" :resourceName="card.name" :upstreamProject="project_id"/>
    </gl-card>
</template>
