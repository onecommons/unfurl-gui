<script>
import gql from 'graphql-tag'
import graphqlClient from 'oc/graphql-shim'
import {Autocomplete as ElAutocomplete, Input as ElInput, Card as ElCard} from 'element-ui'
import {fetchUserProjects} from 'oc_vue_shared/client_utils/user'
import {mapActions} from 'vuex'

/*
const response = {
  "data": {
    "project": {
      "__typename": "Project",
      "id": "gid://gitlab/Project/24189702",
      "containerRepositoriesCount": 24,
      "containerRepositories": {
        "__typename": "ContainerRepositoryConnection",
        "nodes": [
          {
            "id": "gid://gitlab/ContainerRepository/2263379",
            "migrationState": "import_done",
            "name": "gitlab-toolbox-ce",
            "path": "aszs/cng/gitlab-toolbox-ce",
            "status": null,
            "location": "registry.gitlab.com/aszs/cng/gitlab-toolbox-ce",
            "__typename": "ContainerRepository"
          },
          {
            "id": "gid://gitlab/ContainerRepository/2263319",
            "migrationState": "import_done",
            "name": "gitlab-shell-libproxyproto",
            "path": "aszs/cng/gitlab-shell-libproxyproto",
            "status": null,
            "location": "registry.gitlab.com/aszs/cng/gitlab-shell-libproxyproto",
            "__typename": "ContainerRepository"
          },
          {
            "id": "gid://gitlab/ContainerRepository/2263219",
            "migrationState": "import_done",
            "name": "gitlab-gomplate",
            "path": "aszs/cng/gitlab-gomplate",
            "status": null,
            "location": "registry.gitlab.com/aszs/cng/gitlab-gomplate",
            "__typename": "ContainerRepository"
          },
          {
            "id": "gid://gitlab/ContainerRepository/1690598",
            "migrationState": "import_done",
            "name": "gitaly",
            "path": "aszs/cng/gitaly",
            "status": null,
            "location": "registry.gitlab.com/aszs/cng/gitaly",
            "__typename": "ContainerRepository"
          },
          {
            "id": "gid://gitlab/ContainerRepository/1690570",
            "migrationState": "import_done",
            "name": "gitlab-workhorse-ce",
            "path": "aszs/cng/gitlab-workhorse-ce",
            "status": null,
            "location": "registry.gitlab.com/aszs/cng/gitlab-workhorse-ce",
            "__typename": "ContainerRepository"
          },
          {
            "id": "gid://gitlab/ContainerRepository/1690561",
            "migrationState": "import_done",
            "name": "gitlab-task-runner-ce",
            "path": "aszs/cng/gitlab-task-runner-ce",
            "status": null,
            "location": "registry.gitlab.com/aszs/cng/gitlab-task-runner-ce",
            "__typename": "ContainerRepository"
          },
          {
            "id": "gid://gitlab/ContainerRepository/1690558",
            "migrationState": "import_done",
            "name": "gitlab-sidekiq-ce",
            "path": "aszs/cng/gitlab-sidekiq-ce",
            "status": null,
            "location": "registry.gitlab.com/aszs/cng/gitlab-sidekiq-ce",
            "__typename": "ContainerRepository"
          },
          {
            "id": "gid://gitlab/ContainerRepository/1690557",
            "migrationState": "import_done",
            "name": "gitlab-webservice-ce",
            "path": "aszs/cng/gitlab-webservice-ce",
            "status": null,
            "location": "registry.gitlab.com/aszs/cng/gitlab-webservice-ce",
            "__typename": "ContainerRepository"
          },
          {
            "id": "gid://gitlab/ContainerRepository/1690467",
            "migrationState": "import_done",
            "name": "gitlab-rails-ce",
            "path": "aszs/cng/gitlab-rails-ce",
            "status": null,
            "location": "registry.gitlab.com/aszs/cng/gitlab-rails-ce",
            "__typename": "ContainerRepository"
          },
          {
            "id": "gid://gitlab/ContainerRepository/1690369",
            "migrationState": "import_done",
            "name": "gitlab-container-registry",
            "path": "aszs/cng/gitlab-container-registry",
            "status": null,
            "location": "registry.gitlab.com/aszs/cng/gitlab-container-registry",
            "__typename": "ContainerRepository"
          },
          {
            "id": "gid://gitlab/ContainerRepository/1690366",
            "migrationState": "import_done",
            "name": "gitlab-shell",
            "path": "aszs/cng/gitlab-shell",
            "status": null,
            "location": "registry.gitlab.com/aszs/cng/gitlab-shell",
            "__typename": "ContainerRepository"
          },
          {
            "id": "gid://gitlab/ContainerRepository/1690358",
            "migrationState": "import_done",
            "name": "git-base",
            "path": "aszs/cng/git-base",
            "status": null,
            "location": "registry.gitlab.com/aszs/cng/git-base",
            "__typename": "ContainerRepository"
          },
          {
            "id": "gid://gitlab/ContainerRepository/1690347",
            "migrationState": "import_done",
            "name": "gitlab-pages",
            "path": "aszs/cng/gitlab-pages",
            "status": null,
            "location": "registry.gitlab.com/aszs/cng/gitlab-pages",
            "__typename": "ContainerRepository"
          },
          {
            "id": "gid://gitlab/ContainerRepository/1690346",
            "migrationState": "import_done",
            "name": "gitlab-logger",
            "path": "aszs/cng/gitlab-logger",
            "status": null,
            "location": "registry.gitlab.com/aszs/cng/gitlab-logger",
            "__typename": "ContainerRepository"
          },
          {
            "id": "gid://gitlab/ContainerRepository/1690343",
            "migrationState": "import_done",
            "name": "gitlab-exporter",
            "path": "aszs/cng/gitlab-exporter",
            "status": null,
            "location": "registry.gitlab.com/aszs/cng/gitlab-exporter",
            "__typename": "ContainerRepository"
          },
          {
            "id": "gid://gitlab/ContainerRepository/1690342",
            "migrationState": "import_done",
            "name": "gitlab-mailroom",
            "path": "aszs/cng/gitlab-mailroom",
            "status": null,
            "location": "registry.gitlab.com/aszs/cng/gitlab-mailroom",
            "__typename": "ContainerRepository"
          },
          {
            "id": "gid://gitlab/ContainerRepository/1690339",
            "migrationState": "import_done",
            "name": "gitlab-go",
            "path": "aszs/cng/gitlab-go",
            "status": null,
            "location": "registry.gitlab.com/aszs/cng/gitlab-go",
            "__typename": "ContainerRepository"
          },
          {
            "id": "gid://gitlab/ContainerRepository/1690332",
            "migrationState": "import_done",
            "name": "gitlab-ruby",
            "path": "aszs/cng/gitlab-ruby",
            "status": null,
            "location": "registry.gitlab.com/aszs/cng/gitlab-ruby",
            "__typename": "ContainerRepository"
          },
          {
            "id": "gid://gitlab/ContainerRepository/1690323",
            "migrationState": "import_done",
            "name": "postgresql",
            "path": "aszs/cng/postgresql",
            "status": null,
            "location": "registry.gitlab.com/aszs/cng/postgresql",
            "__typename": "ContainerRepository"
          },
          {
            "id": "gid://gitlab/ContainerRepository/1690315",
            "migrationState": "import_done",
            "name": "gitlab-python",
            "path": "aszs/cng/gitlab-python",
            "status": null,
            "location": "registry.gitlab.com/aszs/cng/gitlab-python",
            "__typename": "ContainerRepository"
          },
          {
            "id": "gid://gitlab/ContainerRepository/1690308",
            "migrationState": "import_done",
            "name": "gitlab-graphicsmagick",
            "path": "aszs/cng/gitlab-graphicsmagick",
            "status": null,
            "location": "registry.gitlab.com/aszs/cng/gitlab-graphicsmagick",
            "__typename": "ContainerRepository"
          },
          {
            "id": "gid://gitlab/ContainerRepository/1690305",
            "migrationState": "import_done",
            "name": "kubectl",
            "path": "aszs/cng/kubectl",
            "status": null,
            "location": "registry.gitlab.com/aszs/cng/kubectl",
            "__typename": "ContainerRepository"
          },
          {
            "id": "gid://gitlab/ContainerRepository/1690301",
            "migrationState": "import_done",
            "name": "cfssl-self-sign",
            "path": "aszs/cng/cfssl-self-sign",
            "status": null,
            "location": "registry.gitlab.com/aszs/cng/cfssl-self-sign",
            "__typename": "ContainerRepository"
          },
          {
            "id": "gid://gitlab/ContainerRepository/1690300",
            "migrationState": "import_done",
            "name": "alpine-certificates",
            "path": "aszs/cng/alpine-certificates",
            "status": null,
            "location": "registry.gitlab.com/aszs/cng/alpine-certificates",
            "__typename": "ContainerRepository"
          }
        ]
      }
    }
  }
}
*/

const query = gql`
query getContainerRepositories($fullPath: ID!) {
    project(fullPath: $fullPath) {
        __typename
        id
        containerRepositoriesCount
        containerRepositories {
          __typename
          nodes {
            id
            name
            path
            status
            location
            __typename
          }
        }
    }
}
`

async function fetchContainerRepositories(fullPath) {
    const response = await graphqlClient.clients.defaultClient.query({
        query,
        variables: {fullPath}
    })

    const nodes = response.data?.project?.containerRepositories?.nodes || []
    return nodes
}


function callbackFilter(query, items) {
    if(!query || items.some(item => item.value == query)) return items
    return items.filter(item => item.value.includes(query))
}

export default {
    name: 'LocalImageRepoSource',
    components: {ElAutocomplete, ElInput, ElCard},
    props: {
        card: Object
    },
    data() {
        const data = {
            containerRepositories: null,
            userProjectSuggestionsPromise: fetchUserProjects(),
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
    watch: {
        project_id(val) {
            this.containerRepositoriesPromise = fetchContainerRepositories(val)
            if(!val) {
                this.repository_id = null
            }
            this.updateValue('project_id')
        },
        repository_id(val) {
            if(!val) {
                this.repository_tag = 'latest'
            }

            this.updateValue('repository_id')
            
            const containerRepository = this.containerRepositories.find(cr => cr.path == val)
            if(!containerRepository) return

            // do I just guess this when containerRepository is missing?
            this.registry_url = containerRepository.location
                .slice(0, 0 - val.length)
                .split('/')
                .filter(pathComponent => pathComponent)
                .join('/') // I don't know if the registry_url can include a path

            this.updateValue('registry_url')
        },
        repository_tag() {
            this.updateValue('repository_tag')
        }
    },
    methods: {
        ...mapActions(['updateProperty', 'updateCardInputValidStatus']),
        updateValue(propertyName) {
            const status = this.project_id && this.repository_id && this.repository_tag ?
                'valid': 'missing'
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
        async getUserProjectSuggestions(queryString, callback) {
            const projects = await this.userProjectSuggestionsPromise
            callback(
                callbackFilter(
                    queryString,
                    projects
                        .map(project => ({value: project.fullPath}))
                )
            )
        },
        async getRepositoryIdSuggestions(queryString, callback) {
            if(!this.containerRepositoriesPromise) {
                this.containerRepositoriesPromise = fetchContainerRepositories(this.repository_id)
            }
            const containerRepositories = this.containerRepositories = await this.containerRepositoriesPromise
            callback(
                callbackFilter(
                    queryString,
                    containerRepositories
                        .map(repo => ({value: repo.path}))
                )
            )
        }
    },
    mounted() {
        this.updateValue()
    }
}
</script>
<template>
    <el-card class="d-flex flex-column">
        <el-autocomplete label="Local Project" clearable style="width: min(500px, 100%)" v-model="project_id" :fetch-suggestions="getUserProjectSuggestions">
            <template #prepend>Local Project</template>
        </el-autocomplete>
        <el-autocomplete label="Container Image" clearable class="mt-4" style="width: min(500px, 100%)" v-if="project_id" v-model="repository_id" :fetch-suggestions="getRepositoryIdSuggestions">
            <template #prepend>Container Image</template>
        </el-autocomplete> 
        <el-input label="Tag" clearable class="mt-4" style="width: min(300px, 100%)" v-if="repository_id && project_id" v-model="repository_tag" :fetch-suggestions="getRepositoryIdSuggestions">
            <template #prepend>Tag</template>
        </el-input> 
    </el-card>
</template>
<style scoped>
</style>
