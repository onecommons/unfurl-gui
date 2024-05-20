export const INTERNAL_STORAGE_KEYS = {

}

export const HIDDEN_OPTION_KEYS = {
    encodedPasswordExportUrls: 'encoded-password-export-urls',
    unfurlServerUrl: 'unfurl-server-url',
    unfurlServerUrlDev: 'unfurl-server-url-dev',
    connectWithoutCopy: 'connect-without-copy',
    sendLatestCommit: 'always-send-latest-commit',
    uploadStateBreakpoint: 'upload-state-breakpoint',
    preserveImportedVuexState: 'preserveImportedVuexState',
    defaultSeverityLevel: 'defaultSeverityLevel',
    defaultNamespace: 'defaultNamespace',
    manualIncrementalDeploy: 'manualIncrementalDeploy',
    azureCloudProvider: 'azureCloudProvider',
    cloudmapRepo: 'cloudmapRepo',
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
    { key: 'manualIncrementalDeploy', label: 'Allow manual incremental deploy', placeholder: 'false' },
    { key: 'azureCloudProvider', label: 'Show Azure as a cloud provider', placeholder: 'false' },
    { key: 'cloudmapRepo', label: 'Use another cloudmap repo', placeholder: 'onecommons/cloudmap' },
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
        localStorage[key] = typeof value == 'string'? value: JSON.stringify(value)
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

export function unfurlServerUrlOverride(currentProject) {
    return lookupKey( HIDDEN_OPTION_KEYS.unfurlServerUrl ) || unfurlServerUrlDev(currentProject)
}

export function unfurlServerUrlDev(currentProject) {
    const setting = lookupKey( HIDDEN_OPTION_KEYS.unfurlServerUrlDev )
    if(setting) {
        let {project, url} = JSON.parse(setting)
        if(!project || project != currentProject) return
        if(url.startsWith('localhost')) {
            url = `http://${url}`
        }
        try {
            return (new URL(url)).toString()
        } catch(e) {
            console.error(e)
        }
    }
}

export function alwaysSendLatestCommit() {
    return lookupKey( HIDDEN_OPTION_KEYS.sendLatestCommit )
}

export function defaultSeverityLevel() {
    return lookupKey( HIDDEN_OPTION_KEYS.defaultSeverityLevel ) || 'major'
}

export function cloudmapRepo() {
    return lookupKey( HIDDEN_OPTION_KEYS.cloudmapRepo ) || 'onecommons/cloudmap'
}

export function useImportedStateOnBreakpointOrElse(breakpointName, cb) {
    const newState = sessionStorage['unfurl-gui:state']
    if(newState && [lookupKey('uploadStateBreakpoint'), 'loadDashboard'].includes(breakpointName)) {
        window.$store.replaceState({...window.$store.state, ...JSON.parse(newState)})
        if(!lookupKey('preserveImportedVuexState')) delete sessionStorage['unfurl-gui:state']
    } else {return cb()}

}
export function hasMatchingStorage(re) {
    return (
        Object.keys(localStorage).some(k => k.startsWith('unfurl_gui:') && re.test(k)) ||
        Object.keys(sessionStorage).some(k => k.startsWith('unfurl_gui:') && re.test(k))
    )
}

export function clearMatchingStorage(re, visit) {
    function _visit(k) { if(typeof visit == 'function') visit(k) }
    for(const storage of [localStorage, sessionStorage]) {
        Object.keys(storage).filter(k => k.startsWith('unfurl_gui:') && re.test(k)).forEach(k => {_visit(k); delete storage[k]})
    }
}

export const XHR_JAIL_URL = '/oc/assets/-/crossorigin-xhr.html'
export const DEFAULT_UNFURL_SERVER_URL = window.gon.unfurl_server_url || '/services/unfurl-server'


window.lsHiddenOptions = function() {
    for(const opt of Object.values(HIDDEN_OPTION_KEYS)) console.log(opt)
}
