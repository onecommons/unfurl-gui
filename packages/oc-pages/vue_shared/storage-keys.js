export const INTERNAL_STORAGE_KEYS = {

}

export const HIDDEN_OPTION_KEYS = {
    encodedPasswordExportUrls: 'encoded-password-export-urls'
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
