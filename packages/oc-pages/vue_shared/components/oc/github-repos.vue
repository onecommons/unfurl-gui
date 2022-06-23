<script>
import axios from '~/lib/utils/axios_utils'
import {GlLoadingIcon} from '@gitlab/ui'
import GitHubReposAuthenticate from './github-repos/github-repos-authenticate.vue'

const AUTHENTICATED = 1
const UNAUTHENTICATED = 2
export default {
    name: 'GitHubRepos',
    components: {
        GitHubReposAuthenticate,
        GlLoadingIcon
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

        }
    },

    mounted() {
        this.loadStatus()
    }

}
</script>
<template>
    <div>
        <div v-if="status == AUTHENTICATED">
            <div v-for="repo in provider_repos">{{repo.full_name}}</div>
        </div>
        <div v-else-if="status == UNAUTHENTICATED">
            <GitHubReposAuthenticate @authenticationWindowClosed="loadStatus" />
        </div>
        <div v-else> <gl-loading-icon label="" size="lg"/> </div>
    </div>
</template>
