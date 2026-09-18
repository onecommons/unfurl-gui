import {watchSetFor, applyEvent, ensureWatching, closeAllWatches, resumeWatching} from './unfurl-server-events'
import {setLastCommit, getLastCommit} from './projects'

const PROJECT = 'group/sub/dashboard'
const OTHER = 'group/sub/other'

// jsdom has no EventSource
class FakeEventSource {
    constructor(url) {
        this.url = url
        this.closed = false
        FakeEventSource.instances.push(this)
    }
    close() { this.closed = true }
    emit(payload) { this.onmessage?.({data: JSON.stringify(payload)}) }
    fail() { this.onerror?.(new Event('error')) }
    static get last() { return FakeEventSource.instances.at(-1) }
}

beforeEach(() => {
    sessionStorage.clear()
    closeAllWatches()
    FakeEventSource.instances = []
    global.EventSource = FakeEventSource
})

describe('the watch set', () => {
    it('is the queued entries already in sessionStorage', () => {
        setLastCommit(PROJECT, 'main', {commit: 'aaa', queueid: 3})

        expect(watchSetFor(PROJECT)).toEqual([{branch: 'main', commit: 'aaa', queueid: 3}])
    })

    // queueid 0 is "nothing in flight" -- watching it would never settle
    it('leaves out entries with no queued write', () => {
        setLastCommit(PROJECT, 'main', {commit: 'aaa', queueid: 0})

        expect(watchSetFor(PROJECT)).toEqual([])
    })

    it('does not reach into another project', () => {
        setLastCommit(OTHER, 'main', {commit: 'bbb', queueid: 1})

        expect(watchSetFor(PROJECT)).toEqual([])
    })

    // the key is `${projectPath}#${branch}.latest_commit` with BOTH halves
    // stored raw, so a branch containing the separator must still come back
    it('reads a branch name containing a slash', () => {
        setLastCommit(PROJECT, 'feature/thing', {commit: 'aaa', queueid: 2})

        expect(watchSetFor(PROJECT)).toEqual([{branch: 'feature/thing', commit: 'aaa', queueid: 2}])
    })
})

describe('applying an event', () => {
    beforeEach(() => setLastCommit(PROJECT, 'main', {commit: 'aaa', queueid: 2}))

    it('advances to the new commit and clears the queueid', () => {
        applyEvent(PROJECT, {status: 'ok', branch: 'main', latest_commit: 'aaa', new_commit: 'bbb', queueid: 2})

        expect(getLastCommit(PROJECT, 'main')).toMatchObject({commit: 'bbb', queueid: 0})
    })

    // the backend rolled the batch back to this commit, so it is still current
    it('keeps the commit when the write was discarded', () => {
        applyEvent(PROJECT, {status: 'discarded', branch: 'main', latest_commit: 'aaa', queueid: 2})

        expect(getLastCommit(PROJECT, 'main')).toMatchObject({commit: 'aaa', queueid: 0})
    })

    /*
     * The guard. The event describes aaa@2, but the user saved again since and
     * storage holds aaa@3. Recording bbb@0 would forget that queueid 3 is still
     * in flight, and the next read would show pre-write state.
     */
    it('ignores an event overtaken by a later write', () => {
        setLastCommit(PROJECT, 'main', {commit: 'aaa', queueid: 3})

        expect(applyEvent(PROJECT, {status: 'ok', branch: 'main', latest_commit: 'aaa', new_commit: 'bbb', queueid: 2})).toBe(false)
        expect(getLastCommit(PROJECT, 'main')).toMatchObject({commit: 'aaa', queueid: 3})
    })

    it('ignores a discard overtaken by a later write', () => {
        setLastCommit(PROJECT, 'main', {commit: 'aaa', queueid: 3})

        applyEvent(PROJECT, {status: 'discarded', branch: 'main', latest_commit: 'aaa', queueid: 2})

        expect(getLastCommit(PROJECT, 'main')).toMatchObject({queueid: 3})
    })

    it('ignores an event for a commit we have moved off', () => {
        applyEvent(PROJECT, {status: 'ok', branch: 'main', latest_commit: 'zzz', new_commit: 'bbb', queueid: 2})

        expect(getLastCommit(PROJECT, 'main')).toMatchObject({commit: 'aaa', queueid: 2})
    })

    it('ignores a branch it knows nothing about', () => {
        expect(applyEvent(PROJECT, {status: 'ok', branch: 'other', latest_commit: 'aaa', new_commit: 'bbb', queueid: 2})).toBe(false)
    })
})

describe('the connection', () => {
    it('sends one repeated watch param per queued branch', () => {
        setLastCommit(PROJECT, 'main', {commit: 'aaa', queueid: 1})
        setLastCommit(PROJECT, 'topic', {commit: 'ccc', queueid: 2})

        ensureWatching(PROJECT)

        const {url} = FakeEventSource.last
        expect(url).toContain(`auth_project=${encodeURIComponent(PROJECT)}`)
        expect(url.match(/[?&]watch=/g)).toHaveLength(2)
        expect(url).toContain(encodeURIComponent('main:aaa:1'))
        expect(url).toContain(encodeURIComponent('topic:ccc:2'))
    })

    // the caller passes the base url it already resolved, which is what carries
    // the dev override here without this module importing unfurl-server
    it('opens against the base url the caller resolved', () => {
        setLastCommit(PROJECT, 'main', {commit: 'aaa', queueid: 1})

        ensureWatching(PROJECT, 'http://localhost:8099/services/unfurl-server')

        expect(FakeEventSource.last.url).toContain('http://localhost:8099/services/unfurl-server/events?')
    })

    it('reuses that base url when reopening after a hidden tab', () => {
        setLastCommit(PROJECT, 'main', {commit: 'aaa', queueid: 1})
        ensureWatching(PROJECT, 'http://localhost:8099/services/unfurl-server')
        closeAllWatches()

        resumeWatching()

        expect(FakeEventSource.last.url).toContain('http://localhost:8099')
    })

    it('opens nothing when no write is in flight', () => {
        setLastCommit(PROJECT, 'main', {commit: 'aaa', queueid: 0})

        ensureWatching(PROJECT)

        expect(FakeEventSource.instances).toHaveLength(0)
    })

    // called on every write, so repeating it has to be free
    it('does not reopen for an unchanged watch set', () => {
        setLastCommit(PROJECT, 'main', {commit: 'aaa', queueid: 1})

        ensureWatching(PROJECT)
        ensureWatching(PROJECT)

        expect(FakeEventSource.instances).toHaveLength(1)
    })

    it('reopens when another branch joins the watch set', () => {
        setLastCommit(PROJECT, 'main', {commit: 'aaa', queueid: 1})
        ensureWatching(PROJECT)

        setLastCommit(PROJECT, 'topic', {commit: 'ccc', queueid: 2})
        ensureWatching(PROJECT)

        expect(FakeEventSource.instances).toHaveLength(2)
        expect(FakeEventSource.instances[0].closed).toBe(true)
    })

    // EventSource reconnects when a stream merely ends, so a `done` that left
    // the connection open would re-watch settled keys forever
    it('closes on the terminal done frame', () => {
        setLastCommit(PROJECT, 'main', {commit: 'aaa', queueid: 1})
        ensureWatching(PROJECT)

        FakeEventSource.last.emit({status: 'done'})

        expect(FakeEventSource.last.closed).toBe(true)
    })

    it('applies an event delivered over the stream', () => {
        setLastCommit(PROJECT, 'main', {commit: 'aaa', queueid: 1})
        ensureWatching(PROJECT)

        FakeEventSource.last.emit({status: 'ok', branch: 'main', latest_commit: 'aaa', new_commit: 'bbb', queueid: 1})

        expect(getLastCommit(PROJECT, 'main')).toMatchObject({commit: 'bbb', queueid: 0})
    })

    // strictly additive: the blocking read already delivers correct behaviour,
    // so a stream that cannot connect must change nothing and stay quiet
    it('closes on error and leaves stored state alone', () => {
        setLastCommit(PROJECT, 'main', {commit: 'aaa', queueid: 1})
        ensureWatching(PROJECT)

        FakeEventSource.last.fail()

        expect(FakeEventSource.last.closed).toBe(true)
        expect(getLastCommit(PROJECT, 'main')).toMatchObject({commit: 'aaa', queueid: 1})
    })

    it('survives a browser with no EventSource', () => {
        delete global.EventSource
        setLastCommit(PROJECT, 'main', {commit: 'aaa', queueid: 1})

        expect(() => ensureWatching(PROJECT)).not.toThrow()
    })

    it('ignores a frame that is not json', () => {
        setLastCommit(PROJECT, 'main', {commit: 'aaa', queueid: 1})
        ensureWatching(PROJECT)

        expect(() => FakeEventSource.last.onmessage({data: 'not json'})).not.toThrow()
    })
})
