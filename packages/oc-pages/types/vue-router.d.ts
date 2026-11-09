import '@gitlab/vue-router-vue3'

declare module '@gitlab/vue-router-vue3' {
    interface Router {
        // each app's createRouter names its router ('dashboard', 'overview')
        name?: string
    }
}
