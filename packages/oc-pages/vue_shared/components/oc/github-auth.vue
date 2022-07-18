<script>
import GithubReposAuthenticate from './github-repos/github-repos-authenticate.vue'
import {oauthStatus} from '../../client_utils/github-import'
import { Card as ElCard } from 'element-ui'
export default {
    name: 'GithubAuth',
    data() {
        return {oauthStatus}
    },
    components: {
        GithubReposAuthenticate,
        ElCard
    },
    props: {
        importHandler: Object
    },
    oauthStatus
}
</script>
<template>
    <el-card class="auth-container" v-loading="!importHandler.status">
        <github-repos-authenticate @authenticationWindowClosed="importHandler.loadRepos()" v-if="importHandler.status == oauthStatus.UNAUTHENTICATED"/>
        <div v-show="importHandler.status == oauthStatus.AUTHENTICATED" class="d-contents">
            <slot></slot>
        </div>
    </el-card>
</template>
<style scoped>
.auth-container {
    min-height: 75px;
}
.auth-container >>> .el-loading-mask {
    background-color: rgb(50 50 50 / 90%);
}

</style>
