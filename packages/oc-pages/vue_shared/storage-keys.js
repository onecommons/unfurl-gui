export const INTERNAL_STORAGE_KEYS = {

}

export const HIDDEN_OPTION_KEYS = {
    encodedPasswordExportUrls: 'encoded-password-export-urls',
    unfurlServerUrl: 'unfurl-server-url',
    connectWithoutCopy: 'connect-without-copy',
    sendLatestCommit: 'always-send-latest-commit',
    uploadStateBreakpoint: 'upload-state-breakpoint',
    preserveImportedVuexState: 'preserveImportedVuexState',
    defaultSeverityLevel: 'defaultSeverityLevel',
    defaultNamespace: 'defaultNamespace',
    manualIncrementalDeploy: 'manualIncrementalDeploy'
}

export const CONFIGURABLE_HIDDEN_OPTIONS = [
    { key: 'unfurlServerUrl', label: 'Unfurl Server URL' },
    { key: 'encodedPasswordExportUrls', label: 'Encode Passwords in URL', placeholder: 'false' },
    { key: 'connectWithoutCopy', label: 'Connect External Without Copy', placeholder: 'false' },
    { key: 'sendLatestCommit', label: 'Latest Commit for UFSV URL', placeholder: 'false' },
    { key: 'uploadStateBreakpoint', label: 'Replace Vuex State at X', placeholder: 'loadDashboard' },
    { key: 'preserveImportedVuexState', label: "Load Vuex from file onreload", placeholder: 'false' },
    { key: 'defaultSeverityLevel', label: "Show Errors of at least X Severity", placeholder: 'minor, [major], critical' },
    { key: 'defaultNamespace', label: "Use namespace instead of username" },
    { key: 'manualIncrementalDeploy', label: 'Allow manual incremental deploy', placeholder: false }
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

export function defaultSeverityLevel() {
    return lookupKey( HIDDEN_OPTION_KEYS.defaultSeverityLevel ) || 'major'
}

export function useImportedStateOnBreakpointOrElse(breakpointName, cb) {
    const newState = sessionStorage['unfurl-gui:state']
    if(newState && [lookupKey('uploadStateBreakpoint'), 'loadDashboard'].includes(breakpointName)) {
        window.$store.replaceState({...window.$store.state, ...JSON.parse(newState)})
        if(!lookupKey('preserveImportedVuexState')) delete sessionStorage['unfurl-gui:state']
    } else {return cb()}

}
export const XHR_JAIL_URL = '/oc/assets/-/crossorigin-xhr.html'
export const DEFAULT_UNFURL_SERVER_URL = '/services/unfurl-server'


window.lsHiddenOptions = function() {
    for(const opt of Object.values(HIDDEN_OPTION_KEYS)) console.log(opt)
}
