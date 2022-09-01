<script>
const STATUS_URL = '/import/github/status?close=true'
import {sleep} from '../../../client_utils/misc'
import {oauthStatus} from '../../../client_utils/github-import'
import {GlIcon, GlButton} from '@gitlab/ui'
export default {
    name: 'GitHubReposAuthenticate',
    components: {GlIcon, GlButton},
    props: {
        importHandler: Object
    },
    methods: {
        async openStatus(e) {
            e.preventDefault()
            const height = Math.floor(Math.max(window.outerHeight / 2, 600))
            const width = Math.floor(Math.max(window.outerWidth / 2, 400))
            const left = screen.width / 2 - width / 2
            const top = screen.height / 2 - height / 2
            let handle = window.open(
                STATUS_URL,
                "_blank",
                `resizable=1, scrollbars=1, fullscreen=0, left=${left}, top=${top}, height=${height}, width=${width}, toolbar=0, menubar=0, status=0`
            )
            
            // not sure if this is necessary - open it in a different tab
            if(handle == null) {
                handle = window.open(STATUS_URL, "_blank")
            }

            if(handle) {
                while(!handle.closed && this.importHandler.status == oauthStatus.UNAUTHENTICATED) {
                    await this.importHandler.loadRepos()
                    await sleep(30)
                }
                handle.close()
                if(this.importHandler.status == oauthStatus.AUTHENTICATED) {
                    this.$emit('authenticated')
                }
            } else {
              window.location.href = STATUS_URL
            }

        }
    }

}
</script>
<template>
    <div>
        <h3>Authenticate with GitHub</h3>
        <p>To connect GitHub repositories, you first need to authorize Unfurl.cloud to access the list of your GitHub repositories.</p>
        <gl-button @click="openStatus" href="/import/github/status" variant="confirm"><gl-icon class="mr-2" :size="16" name="github"/>Authenticate with GitHub</gl-button>
    </div>
</template>
