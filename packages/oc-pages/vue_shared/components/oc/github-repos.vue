<script>
import axios from '~/lib/utils/axios_utils'
import {GlTabs, GlLoadingIcon, GlPaginatedList} from '@gitlab/ui'
import OcTab from './oc-tab.vue'
import GitHubReposAuthenticate from './github-repos/github-repos-authenticate.vue'

const AUTHENTICATED = 1
const UNAUTHENTICATED = 2
export default {
    name: 'GitHubRepos',
    components: {
        GitHubReposAuthenticate,
        GlLoadingIcon,
        GlPaginatedList,
        GlTabs,
        OcTab
    },
    props: {
        githubImportConfigured: Boolean,
        githubStatusImportPath: Boolean,
    },

    data() {
        const imported_projects = []
        const incompatible_repos = []
        const provider_repos = []
        const status = 0

        return {
            imported_projects,
            incompatible_repos,
            provider_repos,
            status,
            AUTHENTICATED,
            UNAUTHENTICATED,
        }
    },

    methods: {
        async loadStatus() {
            try {
                const result = await axios.get('/import/github/status.json')
                if(result.status < 300) {
                    this.status = AUTHENTICATED
                    Object.assign(this, result.data)
                }
                console.log(result)
            } catch(e) {
                if(e.request.status === 0) {
                    this.status = UNAUTHENTICATED
                    // CORS redirect
                } else {
                    console.log(Object.entries(e))
                }
            }

        },
        namespaceFromFullName(fullName) {
            return fullName.split('/').slice(0, -1).join('/')
        }
    },

    computed: {
        reposByTab() {
            const result = {}
            for(const repo of this.provider_repos) {
                const namespace = this.namespaceFromFullName(repo.full_name)
                const list = result[namespace] || []
                list.push({...repo, namespace})
                result[namespace] = list
            }
            return result
        },
        tabs() {
            return Object.keys(this.reposByTab)
        }
    },

    mounted() {
        this.loadStatus()
    },


}
</script>
<template>
    <div>
        <div v-if="status == AUTHENTICATED">
            <gl-tabs justified>
                <oc-tab :title="tab" :key="tab" v-for="tab in tabs">
                    <gl-paginated-list :per-page="5" filter="full_name" itemKey="full_name" :list="reposByTab[tab]">
                        <template #default="{listItem}">
                            {{listItem.full_name}}
                        </template>
                    </gl-paginated-list>
                    <!-- <div v-for="repo in reposByTab[tab]">{{repo.full_name}}</div> -->
                </oc-tab>
            </gl-tabs>
        </div>
        <div v-else-if="status == UNAUTHENTICATED">
            <GitHubReposAuthenticate @authenticationWindowClosed="loadStatus" />
        </div>
        <div v-else> <gl-loading-icon label="" size="lg"/> </div>
    </div>
</template>
