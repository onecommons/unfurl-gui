<script>
import axios from '~/lib/utils/axios_utils'
import {GlTabs, GlLoadingIcon, GlPagination, GlSearchBoxByType} from '@gitlab/ui'
import OcTab from './oc-tab.vue'
import GitHubReposAuthenticate from './github-repos/github-repos-authenticate.vue'

const AUTHENTICATED = 1
const UNAUTHENTICATED = 2
export default {
    name: 'GitHubRepos',
    components: {
        GitHubReposAuthenticate,
        GlLoadingIcon,
        GlPagination,
        GlSearchBoxByType,
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
            // GlPaginatedList was removed in @gitlab/ui 136; it provided the
            // filter box, the pager and the per-item slot together
            repoFilter: '',
            repoPage: {},
            REPOS_PER_PAGE: 5,
        }
    },

    methods: {
        filteredRepos(tab) {
            const list = this.reposByTab[tab] || []
            const needle = this.repoFilter.trim().toLowerCase()
            return needle ? list.filter(r => r.full_name?.toLowerCase().includes(needle)) : list
        },
        pagedRepos(tab) {
            const start = ((this.repoPage[tab] || 1) - 1) * this.REPOS_PER_PAGE
            return this.filteredRepos(tab).slice(start, start + this.REPOS_PER_PAGE)
        },
        async loadStatus() {
            try {
                const result = await axios.get('/import/github/status.json')
                if(result.status < 300) {
                    this.status = AUTHENTICATED
                    Object.assign(this, result.data)
                }
            } catch(e) {
                if(e.request.status === 0) {
                    this.status = UNAUTHENTICATED
                    // CORS redirect
                } else {
                    console.error(e)
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
                    <gl-search-box-by-type v-model="repoFilter" :placeholder="__('Filter')" class="gl-mb-3" />
                    <div v-for="listItem in pagedRepos(tab)" :key="listItem.full_name" data-testid="github-repo-item">
                        {{listItem.full_name}}
                    </div>
                    <gl-pagination
                        v-if="filteredRepos(tab).length > REPOS_PER_PAGE"
                        :value="repoPage[tab] || 1"
                        :per-page="REPOS_PER_PAGE"
                        :total-items="filteredRepos(tab).length"
                        align="center"
                        @input="page => repoPage[tab] = page"
                    />
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
