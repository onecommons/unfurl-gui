<script>
import Vue from 'vue'
import gql from 'graphql-tag'
import graphqlClient from 'oc/graphql-shim'
import axios from '~/lib/utils/axios_utils'
import {Autocomplete as ElAutocomplete, Input as ElInput, Card as ElCard} from 'element-ui'
import {fetchUserProjects} from 'oc_vue_shared/client_utils/user'
import {fetchRepositoryBranches, fetchProjectInfo} from 'oc_vue_shared/client_utils/projects'
import {GithubImportHandler, importStatus, oauthStatus} from 'oc_vue_shared/client_utils/github-import'
import {mapActions, mapGetters} from 'vuex'
import GithubAuth from 'oc_vue_shared/components/oc/github-auth.vue'
import ImportButton from 'oc_vue_shared/components/oc/import-button.vue'

const {AUTHENTICATED, UNAUTHENTICATED} = oauthStatus

function callbackFilter(query, items) {
    if(!query || items.some(item => item.value == query)) return items
    return items.filter(item => item.value.includes(query))
}

export default {
    name: 'GithubMirroredRepoImageSource',
    components: {ElAutocomplete, ElInput, GithubAuth, ImportButton},
    props: {
        card: Object
    },
    data() {
        const importHandler = new GithubImportHandler()
        importHandler.loadRepos()
        const data =  {
            importHandler,
            repoImport: null,
            branch: null,
            github_project: null,
            branchesPromise: null,
            projectInfo: null,
            login: null,
            password: null,
            AUTHENTICATED,
            UNAUTHENTICATED,
        }

        return data
    },
    computed: {
        ...mapGetters(['getCurrentNamespace']),
        project_id() {
            if(this.repoImport) {
                return `${this.getCurrentNamespace}/${this.repoImport.sanitized_name}`
            }
            return null
        },
        repository_id() {
            if(this.project_id && this.branch) {
                return `${this.project_id}/${this.branch}`
            }
            return null
        },
        remote_git_url() {
            if(this.project_id) {
                return `${gon.gitlab_url}/${this.project_id}`
            }
        },
        registry_url() {
            if(this.projectInfo && this.project_id) {
                return this.projectInfo.container_registry_image_prefix
                    .slice(0, 0 - this.project_id.length)
                    .split('/')
                    .filter(pathComponent => pathComponent)
                    .join('/') // I don't know if the registry_url can include a path
            }
        }
    },
    watch: {
        github_project(val) {
            this.repoImport = this.importHandler.findRepo(val)
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
        repository_id() {
            this.updateValue('repository_id')
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
                this.setupRegistryCredentials(val.id)
            } else {
                this.branchesPromise = null
            }
        },
    },
    methods: {
        ...mapActions(['updateProperty', 'updateCardInputValidStatus', 'generateProjectTokenIfNeeded']),
        async updateProjectInfo(projectId) {
            this.projectInfo = await fetchProjectInfo(projectId)
        },
        async setupRegistryCredentials(projectId) {
            const {key} = await this.generateProjectTokenIfNeeded({projectId})
            this.login = 'DashboardProjectAccessToken'
            this.password = {get_env: key}
            this.updateValue('login')
            this.updateValue('password')
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
        updateValue(propertyName) {
            const status = (
                this.github_project &&
                this.branch &&
                this.project_id &&
                this.remote_git_url &&
                this.registry_url &&
                this.login &&
                this.password
            ) ? 'valid': 'missing'
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
        onImportFinished() {
            this.branchesPromise = fetchRepositoryBranches(this.repoImport.id)
            this.updateProjectInfo(this.repoImport.id)
            this.setupRegistryCredentials(this.repoImport.id)
        }
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
        })
    }
}
</script>
<template>
        <github-auth :importHandler="importHandler">
            <div class="d-flex flex-wrap justify-content-between">
                <div style="flex-grow: 1;" class="d-flex flex-column">
                    <el-autocomplete label="Github Project" clearable style="width: min(500px, 100%)" v-model="github_project" :fetch-suggestions="getRepoSuggestions">
                        <template #prepend>Github Project</template>
                    </el-autocomplete>
                    <el-autocomplete label="Branch" clearable class="mt-4" style="width: min(300px, 100%)" v-model="branch" :fetch-suggestions="getBranchSuggestions">
                        <template #prepend>Branch</template>
                    </el-autocomplete> 
                </div>
                <div class="d-flex align-items-end">
                    <div>
                        <import-button @importFinished="onImportFinished" :repoImport="repoImport"/>
                    </div>
                </div>
            </div>
        </github-auth> 
    </el-card>
</template>
<style scoped>
</style>
