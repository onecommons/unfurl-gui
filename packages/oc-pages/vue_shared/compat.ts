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
// #!endif
