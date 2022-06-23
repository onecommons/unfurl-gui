<script>
import {GlIcon, GlButton} from '@gitlab/ui'
export default {
    name: 'GitHubReposAuthenticate',
    components: {GlIcon, GlButton},
    methods: {
        openStatus(e) {
            e.preventDefault()
            const height = Math.floor(Math.max(window.outerHeight / 2, 600))
            const width = Math.floor(Math.max(window.outerWidth / 2, 400))
            const left = screen.width / 2 - width / 2
            const top = screen.height / 2 - height / 2
            let handle = window.open(
                "/import/github/status",
                "_blank",
                `resizable=1, scrollbars=1, fullscreen=0, left=${left}, top=${top}, height=${height}, width=${width}, toolbar=0, menubar=0, status=0`
            )
            
            // not sure if this is necessary - open it in a different tab
            if(handle == null) {
                handle = window.open("/import/github/status", "_blank")
            }

            if(handle) {
                console.log(handle)
                const timer = setInterval(() => {
                    if(handle.closed) {
                        console.log("Handle closed")
                        this.$emit('authenticationWindowClosed')
                        clearInterval(timer)
                    }
                }, 100)

            } else {
                window.location.href = "/import/github/status"
            }

        }
    }

}
</script>
<template>
    <div>
        <h3>Authenticate with GitHub</h3>
        <p>To connect GitHub repositories, you first need to authorize GitLab to access the list of your GitHub repositories.</p>
        <gl-button @click="openStatus" href="/import/github/status" variant="confirm"><gl-icon class="mr-2" :size="16" name="github"/>Authenticate with GitHub</gl-button>
    </div>
</template>
