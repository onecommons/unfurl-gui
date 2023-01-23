export const INTERNAL_STORAGE_KEYS = {

}

export const HIDDEN_OPTION_KEYS = {
    encodedPasswordExportUrls: 'encoded-password-export-urls',
    unfurlServerUrl: 'unfurl-server-url',
    connectWithoutCopy: 'connect-without-copy',
    sendLatestCommit: 'always-send-latest-commit'
}

export const CONFIGURABLE_HIDDEN_OPTIONS = [
    { key: 'unfurlServerUrl', label: 'Unfurl Server URL' },
    { key: 'encodedPasswordExportUrls', label: 'Encode Passwords in URL', placeholder: 'false' },
    { key: 'connectWithoutCopy', label: 'Connect External Without Copy', placeholder: 'false' },
    { key: 'sendLatestCommit', label: 'Latest Commit for UFSV URL', placeholder: 'false' },
]

function isTruthyStorageValue(value) {
    try {
        return !!JSON.parse(value)
    } catch(e) {}

    return ['yes', 't', 'y', ''].includes(value)
}

export function setLocalStorageKey(_key, value) {
    let key = HIDDEN_OPTION_KEYS[_key] || _key

    // sessionStorage will override localStorage here
    delete sessionStorage[key]
    delete sessionStorage[`unfurl_gui:${key}`]
    delete localStorage[key]
    delete localStorage[`unfurl_gui:${key}`]

    if(!key.startsWith('unfurl_gui:')) {
        key = `unfurl_gui:${key}`
    }

    if(value !== undefined) {
        localStorage[key] = value
    }
}

export function lookupKey(_key) {
    const key = HIDDEN_OPTION_KEYS[_key] || _key
    if(!key.startsWith('unfurl_gui:')) {
        const lookupResult = lookupKey(`unfurl_gui:${key}`)
        if(lookupResult !== undefined) return lookupResult
    }

    if(sessionStorage.hasOwnProperty(key)) return sessionStorage[key]
    if(localStorage.hasOwnProperty(key)) return localStorage[key]
}

export function clearSettings() {
    Object.values(HIDDEN_OPTION_KEYS).forEach(k => setLocalStorageKey(k, undefined))
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

export function alwaysSendLatestCommit() {
    return lookupKey( HIDDEN_OPTION_KEYS.sendLatestCommit )
}

export function indicateExperimentalSetting() {
    return unfurlServerUrlOverride() || shouldConnectWithoutCopy() || alwaysSendLatestCommit()
}

export const XHR_JAIL_URL = '/oc/assets/-/crossorigin-xhr'
export const DEFAULT_UNFURL_SERVER_URL = '/services/unfurl-server'

window.lsHiddenOptions = function() {
    for(const opt of Object.values(HIDDEN_OPTION_KEYS)) console.log(opt)
}
