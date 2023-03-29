//
// This file contains utility and mounting functions that rely on GitLab
// Our macro doesn't work in vue files, so it's best to handle differences between these environments here.
// Macros are run only on unfurl-gui standalone and result in empty or no-op exports.
//



// #!if false
import csrf from '~/lib/utils/csrf'
import initUnfurlBadgeUrlBuilder from 'oc/pages/projects/edit/uf-badge.js'
let mountJobsConsole
let mountNotesApp
// #!endif

export let token = ''
export let compatibilityMountJobConsole = function() {}
export let compatibilityMountNotesApp = function() {}
export let compatibilityUnfurlBadgeUrlBuilder = function() {}

// #!if false
token = csrf.token
compatibilityUnfurlBadgeUrlBuilder = initUnfurlBadgeUrlBuilder
compatibilityMountJobConsole = async function(...args) {
    if(!mountJobsConsole) {
        mountJobsConsole = import('~/jobs').then(module => module.default)
    }

    (await mountJobsConsole)(...args)
}

compatibilityMountNotesApp = async function(...args) {
    if(!mountNotesApp) {
        mountNotesApp = import('~/notes').then(module => module.default)
    }

    (await mountNotesApp)(...args)
}
// #!endif
