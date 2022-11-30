//
// This file contains utility and mounting functions that rely on GitLab
// Our macro doesn't work in vue files, so it's best to handle differences between these environments here.
// Macros are run only on unfurl-gui standalone and result in empty or no-op exports.
//



// #!if false
import csrf from '~/lib/utils/csrf'
import mountJobsConsole from '~/jobs'
import mountNotesApp from '~/notes'
// #!endif

export let token = ''
export let compatibilityMountJobConsole = function() {}
export let compatibilityMountNotesApp = function() {}

// #!if false
token = csrf.token
compatibilityMountJobConsole = mountJobsConsole
compatibilityMountNotesApp = mountNotesApp

// #!endif
