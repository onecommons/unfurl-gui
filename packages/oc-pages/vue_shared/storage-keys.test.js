import {
    HIDDEN_OPTION_KEYS, setLocalStorageKey, lookupKey, clearSettings, shouldEncodePasswordsInExportUrl,
    shouldConnectWithoutCopy, unfurlServerUrlOverride, unfurlServerUrlDev, alwaysSendLatestCommit,
    defaultSeverityLevel, cloudmapRepo, useImportedStateOnBreakpointOrElse, hasMatchingStorage, clearMatchingStorage,
} from './storage-keys'

beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
})

describe('setting and looking up keys', () => {
    it('stores under the unfurl_gui prefix, by option name or key', () => {
        setLocalStorageKey('cloudmapRepo', 'org/cloudmap')
        expect(localStorage['unfurl_gui:cloudmapRepo']).toBe('org/cloudmap')
        expect(lookupKey('cloudmapRepo')).toBe('org/cloudmap')
        expect(cloudmapRepo()).toBe('org/cloudmap')
    })

    it('stores a non-string as JSON, and clears with undefined', () => {
        setLocalStorageKey('connectWithoutCopy', true)
        expect(localStorage['unfurl_gui:connect-without-copy']).toBe('true')
        expect(shouldConnectWithoutCopy()).toBe(true)
        setLocalStorageKey('connectWithoutCopy', undefined)
        expect(lookupKey('connectWithoutCopy')).toBeUndefined()
    })

    it('prefers session storage, and the prefixed key over a bare one', () => {
        localStorage['defaultSeverityLevel'] = 'minor'
        expect(defaultSeverityLevel()).toBe('minor')
        sessionStorage['defaultSeverityLevel'] = 'critical'
        expect(defaultSeverityLevel()).toBe('critical')
        localStorage['unfurl_gui:defaultSeverityLevel'] = 'major'
        expect(defaultSeverityLevel()).toBe('major')
    })

    it('replaces every copy of a key when setting it', () => {
        sessionStorage['unfurl_gui:always-send-latest-commit'] = 'x'
        localStorage['always-send-latest-commit'] = 'y'
        setLocalStorageKey('sendLatestCommit', 'z')
        expect(alwaysSendLatestCommit()).toBe('z')
        expect(Object.keys(sessionStorage)).toEqual([])
        expect(Object.keys(localStorage)).toEqual(['unfurl_gui:always-send-latest-commit'])
    })

    it('falls back to defaults', () => {
        expect(defaultSeverityLevel()).toBe('major')
        expect(cloudmapRepo()).toBe('onecommons/cloudmap')
    })

    it('clears every hidden option', () => {
        setLocalStorageKey('cloudmapRepo', 'org/c')
        setLocalStorageKey('encodedPasswordExportUrls', 'yes')
        localStorage['unrelated'] = '1'
        clearSettings()
        expect(Object.keys(localStorage)).toEqual(['unrelated'])
    })
})

describe('truthy values', () => {
    it.each([['true', true], ['1', true], ['yes', true], ['t', true], ['y', true], ['', true], ['false', false], ['0', false], ['no', false]])(
        'reads %p as %p', (value, expected) => {
            localStorage['unfurl_gui:encoded-password-export-urls'] = value
            expect(shouldEncodePasswordsInExportUrl()).toBe(expected)
        })

    it('reads an unset option as false', () => {
        expect(shouldEncodePasswordsInExportUrl()).toBe(false)
    })
})

describe('the unfurl server url', () => {
    it('takes an explicit override first', () => {
        setLocalStorageKey('unfurlServerUrl', 'https://ufsv.example')
        expect(unfurlServerUrlOverride('org/p')).toBe('https://ufsv.example')
    })

    it('uses the dev url only for its project, adding a scheme to localhost', () => {
        setLocalStorageKey('unfurlServerUrlDev', {project: 'org/p', url: 'localhost:5001'})
        expect(unfurlServerUrlOverride('org/p')).toBe('http://localhost:5001/')
        expect(unfurlServerUrlDev('org/other')).toBeUndefined()
    })

    it('ignores a dev url that is not one', () => {
        const error = jest.spyOn(console, 'error').mockImplementation(() => {})
        setLocalStorageKey('unfurlServerUrlDev', {project: 'org/p', url: 'not a url'})
        expect(unfurlServerUrlDev('org/p')).toBeUndefined()
        expect(error).toHaveBeenCalled()
        error.mockRestore()
    })
})

describe('imported vuex state', () => {
    const store = () => ({state: {a: 1, b: 1}, replaceState: jest.fn()})

    afterEach(() => { delete window.$store })

    it('runs the callback when no state was imported', () => {
        const cb = jest.fn(() => 'ran')
        expect(useImportedStateOnBreakpointOrElse('loadDashboard', cb)).toBe('ran')
    })

    it('replaces the store at the breakpoint, once', () => {
        window.$store = store()
        sessionStorage['unfurl-gui:state'] = JSON.stringify({b: 2})
        const cb = jest.fn()
        useImportedStateOnBreakpointOrElse('loadDashboard', cb)
        expect(window.$store.replaceState).toHaveBeenCalledWith({a: 1, b: 2})
        expect(cb).not.toHaveBeenCalled()
        expect(sessionStorage['unfurl-gui:state']).toBeUndefined()
    })

    it('keeps the imported state when asked, and waits for a chosen breakpoint', () => {
        window.$store = store()
        sessionStorage['unfurl-gui:state'] = '{}'
        setLocalStorageKey('preserveImportedVuexState', 'true')
        setLocalStorageKey('uploadStateBreakpoint', 'later')
        const cb = jest.fn()
        useImportedStateOnBreakpointOrElse('sooner', cb)
        expect(cb).toHaveBeenCalled()
        useImportedStateOnBreakpointOrElse('later', cb)
        expect(window.$store.replaceState).toHaveBeenCalled()
        expect(sessionStorage['unfurl-gui:state']).toBe('{}')
    })
})

describe('matching storage', () => {
    it('finds and clears only prefixed keys that match', () => {
        localStorage['unfurl_gui:draft-1'] = 'a'
        sessionStorage['unfurl_gui:draft-2'] = 'b'
        localStorage['draft-3'] = 'c'
        localStorage['unfurl_gui:other'] = 'd'

        expect(hasMatchingStorage(/draft/)).toBe(true)
        expect(hasMatchingStorage(/nothing/)).toBe(false)

        const visited = []
        clearMatchingStorage(/draft/, k => visited.push(k))
        expect(visited.sort()).toEqual(['unfurl_gui:draft-1', 'unfurl_gui:draft-2'])
        expect(Object.keys(localStorage).sort()).toEqual(['draft-3', 'unfurl_gui:other'])
        expect(Object.keys(sessionStorage)).toEqual([])
    })

    it('clears without a visitor', () => {
        localStorage['unfurl_gui:draft-1'] = 'a'
        clearMatchingStorage(/draft/)
        expect(hasMatchingStorage(/draft/)).toBe(false)
    })
})

it('lists the hidden options on the console', () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {})
    window.lsHiddenOptions()
    expect(log).toHaveBeenCalledTimes(Object.keys(HIDDEN_OPTION_KEYS).length)
    log.mockRestore()
})
