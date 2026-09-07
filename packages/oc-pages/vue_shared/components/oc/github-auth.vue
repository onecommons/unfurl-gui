<script>
import GithubReposAuthenticate from './github-repos/github-repos-authenticate.vue'
import {oauthStatus} from '../../client_utils/github-import'
import { GlCard, GlLoadingIcon } from '@gitlab/ui'
export default {
    name: 'GithubAuth',
    data() {
        return {oauthStatus}
    },
    components: {
        GithubReposAuthenticate,
        GlCard,
        GlLoadingIcon
    },
    props: {
        importHandler: Object
    },
    oauthStatus
}
</script>
<template>
    <gl-card data-testid="github-auth-card" class="auth-container">
        <div v-if="!importHandler.status" class="gl-flex gl-justify-center gl-py-5">
            <gl-loading-icon size="lg" />
        </div>
        <div v-if="importHandler.status == oauthStatus.UNAUTHENTICATED" class="gl-mb-7">
          <slot name="unauthenticated-pre"></slot>
        </div>
        <github-repos-authenticate @authenticated="$emit('authenticated')" :importHandler="importHandler" v-if="importHandler.status == oauthStatus.UNAUTHENTICATED"/>
        <div v-if="importHandler.status == oauthStatus.UNAUTHENTICATED" class="gl-mt-7">
          <slot name="unauthenticated"></slot>
        </div>
        <!-- there was an element ui bug when this was v-if -->
        <div v-show="importHandler.status == oauthStatus.AUTHENTICATED" class="d-contents">
            <slot></slot>
        </div>
    </gl-card>
</template>
<style scoped>
.auth-container {
    min-height: 75px;
}

</style>
