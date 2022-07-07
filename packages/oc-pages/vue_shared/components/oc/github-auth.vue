<script>
import GithubReposAuthenticate from './github-repos/github-repos-authenticate.vue'
import {oauthStatus} from '../../client_utils/github-import'
export default {
    name: 'GithubAuth',
    data() {
        return {oauthStatus}
    },
    components: {
        GithubReposAuthenticate
    },
    props: {
        importHandler: Object
    },
    oauthStatus
}
</script>
<template>
    <github-repos-authenticate @authenticationWindowClosed="importHandler.loadRepos()" v-if="importHandler.status == oauthStatus.UNAUTHENTICATED"/>
    <div v-else class="d-contents">
        <slot></slot>
    </div>
</template>
