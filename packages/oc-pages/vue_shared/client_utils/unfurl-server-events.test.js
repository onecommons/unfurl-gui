import {watchSetFor, applyEvent, ensureWatching, closeAllWatches, resumeWatching,
    setEventErrorReporter, setStaleHandler, beginWrite, endWrite} from './unfurl-server-events'
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
    setEventErrorReporter(null)
    setStaleHandler(null)
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

/*
 * The write is already gone by the time this arrives: unfurlServerUpdate's
 * promise resolved when the proxy queued the patch, so there is no caller left
 * to throw at. Reporting is the only way the failure reaches the user.
 */
describe('reporting a discarded write', () => {
    let reported

    beforeEach(() => {
        reported = []
        setEventErrorReporter(payload => reported.push(payload))
        setLastCommit(PROJECT, 'main', {commit: 'aaa', queueid: 2})
        ensureWatching(PROJECT)
    })

    const discard = (extra = {}) => FakeEventSource.last.emit({
        status: 'discarded', code: 'WRITE_DISCARDED', branch: 'main',
        latest_commit: 'aaa', queueid: 2,
        message: 'a queued write against this commit was discarded: backend returned 400',
        ...extra,
    })

    // the nested error is Python's own body, which is what the sync path
    // already hands the errors store -- `details` and all
    it('reports the backend error, not the proxy summary', () => {
        const error = {
            status: 400, code: 'BAD_REQUEST',
            message: 'Cannot create environment with reserved name: "secrets"',
            details: 'Traceback (most recent call last):\n  ...',
        }
        discard({error})

        expect(reported).toEqual([{
            message: 'Cannot create environment with reserved name: "secrets"',
            context: error,
            severity: 'critical',
        }])
    })

    // read_batch_error returns null once its key has expired
    it('falls back to the frame when the backend body is gone', () => {
        discard({error: null, batch_queueid: 7})

        expect(reported).toHaveLength(1)
        expect(reported[0].message).toMatch(/backend returned 400/)
        expect(reported[0].context).toEqual({
            code: 'WRITE_DISCARDED',
            message: 'a queued write against this commit was discarded: backend returned 400',
            batch_queueid: 7,
        })
    })

    it('says nothing when the write settled', () => {
        FakeEventSource.last.emit({
            status: 'ok', branch: 'main', latest_commit: 'aaa', new_commit: 'bbb', queueid: 2,
        })

        expect(reported).toEqual([])
    })

    // the frame lost to a later write, so it describes nothing the user is
    // waiting on
    it('says nothing about a frame the guard rejected', () => {
        setLastCommit(PROJECT, 'main', {commit: 'aaa', queueid: 3})
        discard()

        expect(reported).toEqual([])
    })

    it('reports a repeated frame once', () => {
        discard()
        discard()

        expect(reported).toHaveLength(1)
    })

    it('keeps the stream alive when the reporter throws', () => {
        setEventErrorReporter(() => { throw new Error('store is gone') })

        expect(() => discard()).not.toThrow()
        expect(getLastCommit(PROJECT, 'main')).toMatchObject({commit: 'aaa', queueid: 0})
    })

    it('applies the event with no reporter registered', () => {
        setEventErrorReporter(null)
        discard()

        expect(getLastCommit(PROJECT, 'main')).toMatchObject({commit: 'aaa', queueid: 0})
    })
})

/*
 * A supersession says another write was queued against the same base commit,
 * so this client's pending patch was composed without it and will land after
 * it. The write is not lost -- the same watch still reports how it ends.
 */
describe('a superseded write', () => {
    let stale

    beforeEach(() => {
        stale = []
        setStaleHandler(payload => stale.push(payload))
        endWrite(PROJECT, 'main')
        setLastCommit(PROJECT, 'main', {commit: 'aaa', queueid: 2})
        ensureWatching(PROJECT)
    })

    const supersede = (extra = {}) => FakeEventSource.last.emit({
        status: 'superseded', branch: 'main', latest_commit: 'aaa',
        queueid: 2, observed: 5, ...extra,
    })

    it('reports the counter that moved past this client', () => {
        supersede()

        expect(stale).toEqual([{
            projectPath: PROJECT, branch: 'main', commit: 'aaa',
            queueid: 2, observed: 5,
        }])
    })

    /*
     * The trap the guard order exists for. Storage holds queueid 4 while a
     * watch opened on 3 is still delivering, and the counter has reached 7.
     * `ev.queueid` is the watch's position, not the counter, so the
     * ok/discarded guard (`stored.queueid > ev.queueid` -- 4 > 3) would return
     * early and swallow the one event that mattered.
     */
    it('is not swallowed by a watch older than the stored queueid', () => {
        setLastCommit(PROJECT, 'main', {commit: 'aaa', queueid: 4})

        supersede({queueid: 3, observed: 7})

        expect(stale).toHaveLength(1)
        expect(stale[0]).toMatchObject({queueid: 3, observed: 7})
    })

    // the counter moved because of this client's own second write
    it('says nothing when the counter is our own', () => {
        setLastCommit(PROJECT, 'main', {commit: 'aaa', queueid: 5})

        supersede({observed: 5})

        expect(stale).toEqual([])
    })

    /*
     * The queue key -- counter included -- is per (project, branch,
     * latest_commit), so a frame for a base we have moved off describes a
     * different key. Its counter cannot be compared with ours at all.
     */
    it('ignores a frame for a base commit we have moved off', () => {
        setLastCommit(PROJECT, 'main', {commit: 'bbb', queueid: 4})

        supersede({latest_commit: 'aaa', observed: 99})

        expect(stale).toEqual([])
    })

    // deliberately behind: the stored commit is what a later write will be
    // refused for, which is what forces the re-export
    it('leaves the stored commit where it is', () => {
        supersede()

        expect(getLastCommit(PROJECT, 'main')).toMatchObject({
            commit: 'aaa', queueid: 2, stale: true,
        })
    })

    /*
     * The settled frame is the danger this exists for. Our patch was composed
     * without the write that superseded it, so adopting the batch's new commit
     * would leave us looking current while holding data that never saw their
     * change -- and the next write would be accepted against that commit and
     * silently overwrite them.
     */
    it('refuses the settled frame that follows', () => {
        supersede()

        FakeEventSource.last.emit({
            status: 'ok', branch: 'main', latest_commit: 'aaa', new_commit: 'bbb', queueid: 2,
        })

        expect(getLastCommit(PROJECT, 'main')).toMatchObject({commit: 'aaa', queueid: 2})
    })

    // and stops listening, so a reconnect cannot re-subscribe to the result we
    // just declined
    it('drops the watch', () => {
        supersede()

        expect(watchSetFor(PROJECT)).toEqual([])
        expect(FakeEventSource.last.closed).toBe(true)

        resumeWatching()
        expect(watchSetFor(PROJECT)).toEqual([])
    })

    // only a fresh read carries the data we are missing, so only a fresh read
    // unfreezes the branch
    it('is watchable again after a fresh read', () => {
        supersede()
        setLastCommit(PROJECT, 'main', {commit: 'ccc', queueid: 3})

        expect(getLastCommit(PROJECT, 'main').stale).toBeUndefined()
        expect(watchSetFor(PROJECT)).toEqual([{branch: 'main', commit: 'ccc', queueid: 3}])
    })

    /*
     * The counter moves when our POST arrives; our queueid reaches storage a
     * round trip later, and the watch on the previous one stays open across
     * that gap. So a frame in this window describes our own write against a
     * stored queueid that has not caught up -- indistinguishable from someone
     * else's by the counter alone.
     */
    it('says nothing while our own write is still in flight', () => {
        beginWrite(PROJECT, 'main')

        supersede({observed: 7})

        expect(stale).toEqual([])
    })

    // nothing is lost: storing the new queueid reopens the watch, and a counter
    // still ahead of it supersedes again on the new connection
    it('reports once the write is no longer in flight', () => {
        beginWrite(PROJECT, 'main')
        supersede({observed: 7})
        endWrite(PROJECT, 'main')

        supersede({observed: 7})

        expect(stale).toHaveLength(1)
    })

    it('does not suppress another branch', () => {
        beginWrite(PROJECT, 'topic')

        supersede({observed: 7})

        expect(stale).toHaveLength(1)
    })

    it('does not throw with no handler registered', () => {
        setStaleHandler(null)

        expect(() => supersede()).not.toThrow()
    })

    it('keeps the stream alive when the handler throws', () => {
        setStaleHandler(() => { throw new Error('store is gone') })

        expect(() => supersede()).not.toThrow()
    })
})
