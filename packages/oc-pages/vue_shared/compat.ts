//
// This file contains utility and mounting functions that rely on GitLab
// Our macro doesn't work in vue files, so it's best to handle differences between these environments here.
// Macros are run only on unfurl-gui standalone and result in empty or no-op exports.
//



// #!if !standalone
import csrf from '~/lib/utils/csrf'
import initUnfurlBadgeUrlBuilder from 'oc/pages/projects/edit/uf_badge'
let mountJobsConsole: Promise<(...args: unknown[]) => unknown> | undefined
// #!endif

export let token = ''
export let compatibilityMountJobConsole = async function(..._args: unknown[]): Promise<unknown> { return undefined }
// the job console's app goes with the page that mounted it; standalone mounts none
export let compatibilityUnmountJobConsole = function(_app: unknown): void {}
export let compatibilityUnfurlBadgeUrlBuilder = function(): void {}

// #!if !standalone
token = csrf.token
compatibilityUnfurlBadgeUrlBuilder = initUnfurlBadgeUrlBuilder
compatibilityMountJobConsole = async function(...args: unknown[]) {
    if(!mountJobsConsole) {
        mountJobsConsole = import('~/ci/job_details').then(module => module.initJobDetails)
    }

    return (await mountJobsConsole)(...args)
}
// initVueApp's value is a Vue 2 root, a Vue 3 app's instance, or null. This
// does what the fork's unmountVueApp does, without importing it: init_vue_app
// imports vue and is no app root, so even a dynamic import would put this
// module in the fork's Vue 3 lane. vm.$destroy() is inert on a Vue 3 app;
// the app is reached through the root instance's internal appContext.
compatibilityUnmountJobConsole = function(app: unknown) {
    const vm = app as {$root?: unknown} | null | undefined
    if(!vm) return
    const root = (vm.$root || vm) as {$?: {appContext?: {app?: {unmount(): void}}}, $destroy?: () => void}
    const vue3App = root.$?.appContext?.app
    if(vue3App) vue3App.unmount()
    else root.$destroy?.()
}
// #!endif
