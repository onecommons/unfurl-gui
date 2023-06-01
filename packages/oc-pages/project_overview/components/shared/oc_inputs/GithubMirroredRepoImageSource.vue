<script>
import Vue from 'vue'
import axios from '~/lib/utils/axios_utils'
import {Autocomplete as ElAutocomplete, Card as ElCard, Checkbox as ElCheckbox} from 'element-ui'
import {fetchContainerRepositories, fetchRepositoryBranches, fetchProjectInfo} from 'oc_vue_shared/client_utils/projects'
import {triggerPipeline} from 'oc_vue_shared/client_utils/pipelines'
import {GithubImportHandler, importStatus, oauthStatus} from 'oc_vue_shared/client_utils/github-import'
import {mapMutations, mapActions, mapGetters, mapState} from 'vuex'
import GithubAuth from 'oc_vue_shared/components/oc/github-auth.vue'
import ImportButton from 'oc_vue_shared/components/oc/import-button.vue'



import {connectedRepo} from './mixins'


const {AUTHENTICATED, UNAUTHENTICATED} = oauthStatus
const {IMPORTED} = importStatus

function callbackFilter(query, items) {
    if(!query || items.some(item => item.value == query)) return items
    return items.filter(item => item.value?.includes(query))
}

export default {
    name: 'GithubMirroredRepoImageSource',
    components: {ElAutocomplete, GithubAuth, ImportButton, ElCheckbox},
    mixins: [connectedRepo],
    props: {
        card: Object,
        readonly: Boolean
    },
    data() {
        const importHandler = new GithubImportHandler()
        importHandler.loadRepos()
        const data =  {
            importHandler,
            branch: null,
            github_project: null,
            branchesPromise: null,
            projectInfo: null,
            branchError: null, // couldn't get this working in the element ui componenet
            useDefaultBranch: false,
            AUTHENTICATED,
            UNAUTHENTICATED,
            saved: {}
        }

        for(const {name, value} of this.card.properties) {
            if(data.hasOwnProperty(name)) {
                data[name] = value
            } else {
                data.saved[name] = value
            }
        }

        return data
    },
    computed: {
        ...mapGetters(['getDeploymentTemplate', 'getCurrentNamespace', 'getHomeProjectPath', 'registryURL', 'cardIsValid']),
        ...mapState({
            isExternalUser(state) {return state.misc.user?.external}, // intentionally defaulting to false
            userEmail(state) {const user = state.misc.user; return user?.public_email || user?.email}
        }),
        project_id() {
            if(this.repoImport) {
                return `${this.getCurrentNamespace}/${this.repoImport.sanitized_name}`.toLowerCase()
            }
            return this.saved.project_id ?? null
        },
        remote_git_url() {
            if(this.project_id) {
                return `${gon.gitlab_url}/${this.project_id}`
            }
            return this.saved.remote_git_url ?? null
        },
        registry_url() {
            if(this.registryURL) {
                /* eslint-disable */
                setTimeout(() => this.updateValue('registry_url'), 1)
                return this.registryURL // value won't change
            }

            if(this.projectInfo && this.project_id) {
                return this.projectInfo.container_registry_image_prefix
                    .slice(0, 0 - this.project_id.length)
                    .split('/')
                    .filter(pathComponent => pathComponent)
                    .join('/') // I don't know if the registry_url can include a path
            }
            return this.saved.registry_url ?? null
        },
        searchableBranchesTip() {
            return !this.useDefaultBranch && this.github_project && !this.branch && this.repoImport?.importStatus != IMPORTED
        },
        repoImport() {
            if(this.importHandler.status == AUTHENTICATED) {
                return this.importHandler.findRepo(this.github_project)
            }
            return null
        },
        displayableCardProperties() {
            return this.card.properties.filter(property => {
                return ['github_project', 'remote_git_url', 'branch', 'project_id', 'registry_url'].includes(property.name)
            })
        }
    },
    watch: {
        projectInfo() { this.setDefaultBranchIfPossible() },
        useDefaultBranch() { this.setDefaultBranchIfPossible() },
        github_project(val) {
            this.branch = null
            if(this.projectInfo?.id != this.repoImport?.id) {
                this.projectInfo = null
            }
            this.updateValue('github_project')
        },
        branch() {
            this.updateValue('branch')
        },
        project_id() {
            this.updateValue('project_id')
        },
        remote_git_url() {
            this.updateValue('remote_git_url')
        },
        registry_url() {
            this.updateValue('registry_url')
        },
        repoImport(val) {
            if(val?.importStatus > 1) {
                this.branchesPromise = fetchRepositoryBranches(val.id)
                this.updateProjectInfo(val.id)
            } else {
                this.branchesPromise = null
            }
        },
    },
    methods: {
        ...mapActions(['updateProperty', 'updateCardInputValidStatus']),
        ...mapMutations(['onSaveEnvironment', 'setUpstreamCommit', 'setUpstreamId', 'setUpstreamProject', 'setUpstreamBranch']),
        async updateProjectInfo(projectId) {
            this.projectInfo = await fetchProjectInfo(projectId)
            await this.setupRegistryCredentials(this.projectInfo)
        },
        async getRepoSuggestions(queryString, callback) {
            const repos = await this.importHandler.listRepos()
            callback(
                callbackFilter(
                    queryString,
                    repos.map(repo => ({value: repo.externalName}))
                )
            )
        },
        async getBranchSuggestions(queryString, callback) {
            const branches = (await this.branchesPromise) || []
            callback(
                callbackFilter(
                    queryString,
                    branches.map(branch => ({value: branch.name}))
                )
            )
        },

        async onUpdateValue() {
            let result
            if(this.repoImport?.importStatus == IMPORTED) {
                const branches = (await this.branchesPromise) || []
                if(!branches.some(branch => branch.name == this.branch)) {
                    result = 'error'
                    if(this.branch) {
                        this.branchError = true
                    } else {
                        this.branchError = null
                    }
                } else {
                    this.branchError = null
                }
            }
            return result
        },

        async getStatus() {
            return (
                this.github_project &&
                this.branch &&
                this.project_id &&
                this.remote_git_url &&
                this.registry_url &&
                this.credentialsOk
            ) ? 'valid': 'missing'
        },

        onImportFinished() {
            this.branchesPromise = fetchRepositoryBranches(this.repoImport.id)
            this.updateProjectInfo(this.repoImport.id)
            this.setupRegistryCredentials(this.repoImport.id)
        },

        setDefaultBranchIfPossible() {
            if(this.projectInfo && this.useDefaultBranch) {
                this.branch = this.projectInfo.default_branch
            }
        },
    },
    async mounted() {
        this.updateValue()
        const github_project = this.card.properties.find(prop => prop.name == 'github_project')?.value
        if(github_project) {
            await this.importHandler.loadReposPromise
            this.github_project = github_project
        }

        Vue.nextTick(() => {
            this.branch = this.card.properties.find(prop => prop.name == 'branch')?.value
            if(!this.branch) {this.useDefaultBranch = true}
        })


        this.onSaveEnvironment(async () => {
            if(this.cardIsValid(this.card)) {
                if(!this.projectInfo) {
                    await this.updateProjectInfo(encodeURIComponent(this.project_id))
                }

                // TODO check if blueprint default repository_id is already set
                if((await fetchContainerRepositories(this.projectInfo.path_with_namespace)).some(repo => repo.path == `${this.project_id}/${this.branch}`)) {
                    console.log('image already exists')
                    // this.setUpstreamId we need to look up the last pipeline that has the given branch and project
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
                } else {
                    const upstream = await triggerPipeline(`/${this.projectInfo.path_with_namespace}/-/pipelines`, [], {ref: this.branch})
                    this.setUpstreamCommit(upstream.commit)
                    this.setUpstreamId(upstream.id)
                    this.setUpstreamBranch(this.branch || this.projectInfo.default_branch)
                    this.setUpstreamProject(upstream.project)
                }
            }
        })
    }
}
</script>
<template>
    <github-auth :importHandler="importHandler">
        <template v-if="isExternalUser" #unauthenticated-pre>
            <h3>Your profile must be set to developer mode to deploy with GitHub...</h3>
            Visit your <a target="_blank" href="/-/profile/account#user-mode">profile settings page</a> and select <b>"I want to develop applications"</b> for the <b>"User Interface"</b> setting.
            <hr class="mb-5">
        </template>

        <template v-if="cardIsValid(card)" #unauthenticated>
            <h4>Existing properties:</h4>

            <oc-properties-list :properties="displayableCardProperties"/>
            <oc-deployment-scheduler v-if="project_id" :deploymentName="getDeploymentTemplate.name" :resourceName="card.name" :upstreamProject="project_id"/>
        </template>
        <div v-if="isExternalUser">
            <h3>Your profile must be set to developer mode to deploy with GitHub...</h3>
            Visit your <a target="_blank" href="/-/profile/account#user-mode">profile settings page</a> and select <b>"I want to develop applications"</b> for the <b>"User Interface"</b> setting.
            <hr class="mb-5 mt-5">
        </div>
        <div>
            <div class="d-flex flex-wrap justify-content-between">
                <div style="flex-grow: 1;" class="d-flex flex-column">
                    <el-autocomplete label="Github Project" clearable style="width: min(500px, 100%)" v-model="github_project" :fetch-suggestions="getRepoSuggestions" :disabled="readonly">
                        <template #prepend>Github Project</template>
                    </el-autocomplete>
                    <div class="mt-4">
                        <el-autocomplete :disabled="useDefaultBranch || readonly" :error="branchError" label="Branch" clearable style="width: min(500px, 100%)" v-model="branch" :fetch-suggestions="getBranchSuggestions">
                            <template #prepend>Branch</template>
                            <template #append> <el-checkbox :disabled="readonly" class="mb-0" v-model="useDefaultBranch">Default Branch</el-checkbox> </template>
                        </el-autocomplete>
                        <div class="mt-1" style="opacity: 0.9; font-size: 0.9em;">
                            <span v-if="!useDefaultBranch && branchError" style="color: red;">
                                The {{branch}} branch doesn't exist or wasn't imported successfully.
                            </span>
                            <span v-else-if="searchableBranchesTip">
                                Your branches will be searchable above when the import process is finished.
                            </span>
                        </div>
                    </div>
                </div>
                <div class="d-flex align-items-end">
                    <div>
                        <import-button @importFinished="onImportFinished" :repoImport="repoImport"/>
                    </div>
                </div>
            </div>
            <oc-deployment-scheduler v-if="project_id" :deploymentName="getDeploymentTemplate.name" :resourceName="card.name" :upstreamProject="project_id"/>
        </div>
    </github-auth>
    </el-card>
</template>
<style scoped>
</style>
