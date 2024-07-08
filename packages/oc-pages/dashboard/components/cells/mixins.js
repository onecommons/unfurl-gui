export const withApplicationLinkTarget = {
    computed: {
        applicationLinkTarget() {
            if(!this.application.projectPath) return null
            let result
            if(window.gon.unfurl_gui) {
                result = `/${this.application.projectPath}/-/overview`
            } else {
                result = `/${this.application.projectPath}`
            }

            if(this.application.blueprintPath) {
                result += `?blueprintPath=${this.application.blueprintPath}`
            }
            return result
        }
    }
}
