// #!if false
import csrf from '~/lib/utils/csrf'
import mountJobsConsole from '~/jobs'
// #!endif

export let token = ''
export let compatibilityMountJobConsole = function() {}

// #!if false
token = csrf.token
compatibilityMountJobConsole = mountJobsConsole

// #!endif
