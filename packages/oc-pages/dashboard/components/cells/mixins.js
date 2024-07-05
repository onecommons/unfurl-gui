export const withApplicationLinkTarget = {
    computed: {
        applicationLinkTarget() {
            if(!this.application.projectPath) return null
            if(window.gon.unfurl_gui) {
                return `/${this.application.projectPath}/-/overview`
            }
            return `/${this.application.projectPath}`
        }
    }
}
