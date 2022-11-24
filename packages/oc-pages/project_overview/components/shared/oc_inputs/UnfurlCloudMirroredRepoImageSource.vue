<script>
import axios from '~/lib/utils/axios_utils'
import {mapActions, mapMutations, mapGetters} from 'vuex'
import {toDepTokenEnvKey} from 'oc_vue_shared/client_utils/envvars'
import {fetchProjects, fetchRepositoryBranches, fetchProjectInfo} from 'oc_vue_shared/client_utils/projects'
import DeploymentScheduler from '../../../../vue_shared/components/oc/deployment-scheduler.vue'

import {connectedRepo} from './mixins'

function callbackFilter(query, items) {
    if(!query || items.some(item => item.value == query)) return items
    return items.filter(item => item.value.includes(query))
}

export default {
    name: 'UnfurlCloudMirroredRepoImageSource',
    props: {
        card: Object,
        readonly: Boolean
    },
    components: {
        DeploymentScheduler
    },
    mixins: [connectedRepo],
    data() {
        const data = {
            userProjectSuggestionsPromise: fetchProjects({minAccessLevel: 10}),
            repositoryBranchesPromise: null,
            project_id: null,
            branch: null,
            repository_tag: null,
            projectInfo: null,
            gitlabProjectId: -1
        }

        for(const {name, value} of this.card.properties) {
            if(data.hasOwnProperty(name)) {
                data[name] = value
            }
        }

        return data
    },
    methods: {
        ...mapActions(['updateProperty', 'updateCardInputValidStatus', 'generateProjectTokenIfNeeded']),
        ...mapMutations(['onSaveEnvironment', 'setUpstreamProject', 'setUpstreamBranch', 'setUpstreamCommit']),
        async getUserProjectSuggestions(queryString, callback) {
            const projects = await this.userProjectSuggestionsPromise
            callback(
                callbackFilter(
                    queryString,
                    projects
                        .map(project => ({value: project.path_with_namespace}))
                )
            )
        },
        async getBranchSuggestions(queryString, callback) {
            const branches = await this.repositoryBranchesPromise
            callback(
                callbackFilter(
                    queryString,
                    branches
                        .map(branch => ({value: branch.name}))
                )
            )
        },

        getStatus() {
            const status = this.username && this.password && this.project_id && this.repository_id && this.repository_tag && this.registry_url && this.remote_git_url ?
                'valid': 'missing'
            return status
        }
    },
    computed: {
        ...mapGetters(['cardIsValid', 'getDeploymentTemplate', 'getHomeProjectPath']),
        repository_id() {
            if(!(this.project_id && this.branch)) return null
            return `${this.project_id}/${this.branch}`
        },
        registry_url() {
            if(this.projectInfo && this.project_id) {
                return this.projectInfo.container_registry_image_prefix
                    .slice(0, 0 - this.project_id.length)
                    .split('/')
                    .filter(pathComponent => pathComponent)
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

                this.repositoryBranchesPromise = fetchRepositoryBranches(encodeURIComponent(this.project_id))
                this.projectInfo = await fetchProjectInfo(encodeURIComponent(this.project_id))
                const id = this.projectInfo.id
                this.gitlabProjectId = id
                try {
                    this.setupRegistryCredentials(id)
                } catch(e) { }

            }
        },
        branch(val) { this.updateValue('branch') },
        repository_id(val) { this.updateValue('repository_id') },
        repository_tag(val) { this.updateValue('repository_tag') },
        registry_url(val) { this.updateValue('registry_url') },
        remote_git_url(val) { this.updateValue('remote_git_url') },
    },
    async mounted() {
        this.repository_tag = 'latest' // trigger watcher and prepare commit
        this.updateValue()

        this.onSaveEnvironment(async () => {
            if(this.cardIsValid(this.card)) {
                const id = this.projectInfo.id
                const branch = this.branch || this.projectInfo.default_branch
                try {
                  const commits = (await axios.get(`/api/v4/projects/${id}/repository/commits?ref=${branch}`)).data
                  this.setUpstreamCommit(commits[0].id)
                } catch(e) {
                  console.error("couldn't find upstream commit")
                  console.error(e.message)
                }
                this.setUpstreamProject(id)
                this.setUpstreamBranch(branch)
            }
        })

    }
}
</script>
<template>
    <el-card class="d-flex flex-column">
        <el-autocomplete label="Local Project" clearable style="width: min(500px, 100%)" v-model="project_id" :fetch-suggestions="getUserProjectSuggestions" :disabled="readonly">
            <template #prepend>Local Project</template>
        </el-autocomplete>
        <el-autocomplete label="Branch" clearable class="mt-4" style="width: min(500px, 100%)" v-if="project_id" v-model="branch" :fetch-suggestions="getBranchSuggestions" :disabled="readonly">
            <template #prepend>Branch</template>
        </el-autocomplete> 
        <deployment-scheduler v-if="project_id" :deploymentName="getDeploymentTemplate.name" :resourceName="card.name" :upstreamProject="project_id"/>
    </el-card>

</template>
