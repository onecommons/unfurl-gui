export const INTERNAL_STORAGE_KEYS = {

}

export const HIDDEN_OPTION_KEYS = {
    encodedPasswordExportUrls: 'encoded-password-export-urls',
    unfurlServerUrl: 'unfurl-server-url',
    connectWithoutCopy: 'connect-without-copy'
}


function isTruthyStorageValue(value) {
    try {
        return !!JSON.parse(value)
    } catch(e) {}

    return ['yes', 't', 'y', ''].includes(value)
}

function lookupKey(key) {
    if(!key.startsWith('unfurl_gui:')) {
        const lookupResult = lookupKey(`unfurl_gui:${key}`)
        if(lookupResult !== undefined) return lookupResult
    }

    if(sessionStorage.hasOwnProperty(key)) return sessionStorage[key]
    if(localStorage.hasOwnProperty(key)) return localStorage[key]
}

export function shouldEncodePasswordsInExportUrl() {
    return isTruthyStorageValue(lookupKey( HIDDEN_OPTION_KEYS.encodedPasswordExportUrls ))
}

export function shouldConnectWithoutCopy() {
    return isTruthyStorageValue(lookupKey( HIDDEN_OPTION_KEYS.connectWithoutCopy ))
}

export function unfurlServerUrlOverride() {
    return lookupKey( HIDDEN_OPTION_KEYS.unfurlServerUrl )
}

window.lsHiddenOptions = function() {
    for(const opt of Object.values(HIDDEN_OPTION_KEYS)) console.log(opt)
}
