import {DEFAULT_UNFURL_SERVER_URL, unfurlServerUrlOverride} from '../storage-keys'
import {getLastCommit, setLastCommit, discardQueuedWrite} from './projects'

// The server caps the watch set; sending more is a 400 rather than a partial
// subscription, so trim rather than let it refuse the lot.
const MAX_WATCHES = 32

const SUFFIX = '.latest_commit'

// projectPath -> {es, key}. Keyed by project because the watch set is.
const connections = new Map()

// projectPath -> base url the caller resolved. Remembered so resumeWatching
// can reopen with the same one.
const baseUrls = new Map()

// Projects we have been asked to watch at least once. Survives closing, so a
// return from a hidden tab knows what to re-open without a timer or a route
// change driving it.
const watched = new Set()

/*
 * How a discarded write reaches the user. The store is not importable from
 * here -- it imports this, through unfurl-server -- so whoever builds one
 * registers a way to report instead. Unregistered is a normal state: a page
 * with no store still watches, it just says nothing.
 */
let reporter = null

export function setEventErrorReporter(fn) {
    reporter = typeof fn === 'function' ? fn : null
}

/*
 * How a supersession reaches the app. Deliberately not the error reporter: the
 * write is still pending and will most likely land, so the failure chrome --
 * and advice to reload -- would be wrong at the moment it fires. It also has
 * no severity that makes sense, and the error alert's only dismissal clears
 * every other error with it.
 *
 * Nothing registers this yet. The signal is real and the guards above are what
 * make it reliable; what it should surface as is a UI decision, and the wrong
 * surface is worse than none.
 */
let staleHandler = null

export function setStaleHandler(fn) {
    staleHandler = typeof fn === 'function' ? fn : null
}

/*
 * Branches with a write in flight, as `${projectPath}#${branch}`.
 *
 * `observed > stored.queueid` reads "someone else queued after us", but only
 * once our own queueid is stored. The server increments the counter when the
 * POST arrives and we store the result a round trip later, and the watch on
 * our *previous* queueid stays open across that gap -- so a 100ms poll lands a
 * supersession describing our own write, against a stored queueid that has not
 * caught up. Suppressing the window is what makes the comparison honest.
 *
 * Nothing is lost by suppressing: storing the new queueid reopens the watch,
 * and a counter still ahead of it supersedes again on the new connection.
 */
const writing = new Set()

const writeKey = (projectPath, branch) => `${projectPath}#${branch}`

export function beginWrite(projectPath, branch) {
    if (projectPath && branch) writing.add(writeKey(projectPath, branch))
}

export function endWrite(projectPath, branch) {
    if (projectPath && branch) writing.delete(writeKey(projectPath, branch))
}

function reportSuperseded(projectPath, ev) {
    if (!staleHandler) return
    try {
        staleHandler({
            projectPath, branch: ev.branch, commit: ev.latest_commit,
            queueid: ev.queueid, observed: ev.observed,
        })
    } catch (e) {
        // as reportDiscarded: additive only, never take the stream down
    }
}

/*
 * Report a discarded write the way a synchronous one is reported. The frame's
 * nested `error` is the body Python returned -- {status, code, message,
 * details} -- which is what the sync path already passes through, so the
 * errors store finds the traceback under `details` and renders it with the
 * same code-clipboard. No new UI, and the two read alike.
 *
 * `error` is absent when the proxy could not read the stored body (the error
 * key expired, or the sentinel predates it), so fall back to the frame's own
 * account -- the proxy's one-liner, which at least names the upstream status.
 */
function reportDiscarded(ev) {
    if (!reporter) return

    const error = ev.error || {code: ev.code, message: ev.message, batch_queueid: ev.batch_queueid}
    try {
        reporter({
            message: error.message || ev.message || 'A queued update was discarded',
            context: error,
            severity: 'critical',
        })
    } catch (e) {
        // strictly additive: a reporter that throws must not take the stream
        // down with it
    }
}

/*
 * The watch set is not new state: an entry in sessionStorage with queueid > 0
 * already means "a queued write whose result has not been consumed". Read it
 * back rather than tracking it twice.
 *
 * Keys are `${projectPath}#${branch}${SUFFIX}` with the project path stored
 * raw -- projects.js decodes before writing. Both halves can contain the
 * separator, so this only ever matches against a known project path and never
 * tries to parse one back out.
 */
export function watchSetFor(projectPath) {
    const prefix = `${projectPath}#`
    const result = []

    for (const key of Object.keys(sessionStorage)) {
        if (!key.startsWith(prefix) || !key.endsWith(SUFFIX)) continue

        const branch = key.slice(prefix.length, -SUFFIX.length)
        if (!branch) continue

        const stored = getLastCommit(projectPath, branch)
        if (!stored?.commit || !(stored.queueid > 0)) continue
        // frozen by a supersession: we do not want the result, see applyEvent
        if (stored.stale) continue

        result.push({branch, commit: stored.commit, queueid: stored.queueid})
    }

    // branch is unique per key, so (branch, commit) is distinct by construction
    return result.slice(0, MAX_WATCHES)
}

function watchSetKey(watches) {
    return watches.map(w => `${w.branch}:${w.commit}:${w.queueid}`).sort().join('|')
}

function eventsUrl(projectPath, baseUrl, watches) {
    // The caller passes the base url it already resolved, which is how the dev
    // override reaches this without importing unfurl-server (which imports
    // this). Note cookies do not flow to an override host -- it is cross-origin
    // and the server's CORS layer does not set allow_credentials -- so the dev
    // path gets the right URL but may still not authenticate.
    const base = baseUrl || unfurlServerUrlOverride(projectPath) || DEFAULT_UNFURL_SERVER_URL
    const params = [`auth_project=${encodeURIComponent(projectPath)}`]

    for (const w of watches) {
        // repeated, not comma-joined: a branch name may contain a comma
        params.push(`watch=${encodeURIComponent(`${w.branch}:${w.commit}:${w.queueid}`)}`)
    }

    return `${base}/events?${params.join('&')}`.replace(/^\/+/, '/')
}

/*
 * Apply one event. True means the frame was ours to act on -- which for most
 * statuses means stored state changed, and for `superseded` means it
 * deliberately did not. See below.
 *
 * The guard is the whole of the difficulty. The event says "A@2 became B", but
 * the user may have saved again since, leaving storage at {A, 3}. Recording
 * {B, 0} there would forget that queueid 3 is still in flight, and the next
 * read would show pre-write state.
 */
export function applyEvent(projectPath, ev) {
    if (!ev?.branch) return false

    const stored = getLastCommit(projectPath, ev.branch)
    /*
     * Every status describes writes queued against this base commit, and the
     * queue key -- its counter included -- is per (project, branch,
     * latest_commit). So a frame for a base we have moved off is about a
     * different key entirely, and neither its queueid nor its counter can be
     * compared with ours.
     */
    if (stored?.commit !== ev.latest_commit) return false

    if (ev.status === 'superseded') {
        /*
         * `observed` is the key's counter; `ev.queueid` is only the watch's
         * position in it. That is why the queueid guard below must not run
         * here -- with 4 stored and a watch on 3 still live,
         * `stored.queueid > ev.queueid` returns early and swallows exactly the
         * write we needed to hear about.
         *
         * A counter no higher than ours moved because of our own write.
         */
        if (!(ev.observed > (stored.queueid || 0))) return false

        // our own write may already have moved the counter without its queueid
        // having reached storage yet -- see `writing`
        if (writing.has(writeKey(projectPath, ev.branch))) return false

        /*
         * Stop listening, and record why.
         *
         * The settled frame is the danger. Our patch was composed without the
         * write that superseded it, so applying `ok` would store the batch's
         * new commit and leave us looking current while holding data that
         * never saw their change. The next write would then be accepted
         * against that commit and silently overwrite it.
         *
         * So the stored commit stays where it is, deliberately behind. A later
         * write sends a latest_commit and queueid the key has moved past, the
         * server refuses it as a conflict, and unfurlServerUpdate's 409 path
         * clears the entry -- which forces the fresh export that is the only
         * thing that can actually reconcile this.
         *
         * Losing the result is the point, not a cost: there is no commit we
         * could record here that would be safe to write from.
         */
        setLastCommit(projectPath, ev.branch, {...stored, stale: true})
        // recomputed without this branch, and closed outright if it was the only one
        ensureWatching(projectPath)
        return true
    }

    // a frame already in flight when the supersession froze us; the commit it
    // carries is exactly the one we must not adopt
    if (stored.stale) return false
    if (stored.queueid > ev.queueid) return false

    if (ev.status === 'discarded') {
        // Nothing in flight means nothing to discard. Without this a repeated
        // frame applies a second time -- harmless while it only rewrote
        // queueid 0 over queueid 0, but it now reports, and the user would see
        // the same failure twice.
        if (!(stored.queueid > 0)) return false
        // identical to the 409 WRITE_DISCARDED path in unfurl-server.js, and
        // shared with it so the two cannot drift
        return discardQueuedWrite(projectPath, ev.branch)
    }

    if (ev.status === 'ok' && ev.new_commit) {
        setLastCommit(projectPath, ev.branch, {commit: ev.new_commit, queueid: 0})
        return true
    }

    return false
}

export function closeWatch(projectPath) {
    const existing = connections.get(projectPath)
    if (!existing) return

    connections.delete(projectPath)
    try { existing.es.close() } catch (e) { /* already gone */ }
}

export function closeAllWatches() {
    for (const projectPath of [...connections.keys()]) closeWatch(projectPath)
}

/*
 * Idempotent: called on every write, and a no-op when the watch set has not
 * changed. Strictly additive -- the blocking read already delivers correct
 * behaviour, so a stream that never connects must leave the app exactly as it
 * is today. Hence onerror closes and says nothing, and nothing anywhere waits
 * on an event arriving.
 */
export function ensureWatching(projectPath, baseUrl) {
    if (!projectPath || typeof EventSource === 'undefined') return

    watched.add(projectPath)
    if (baseUrl) baseUrls.set(projectPath, baseUrl)

    const watches = watchSetFor(projectPath)
    if (!watches.length) {
        closeWatch(projectPath)
        return
    }

    const key = watchSetKey(watches)
    if (connections.get(projectPath)?.key === key) return

    closeWatch(projectPath)

    let es
    try {
        es = new EventSource(eventsUrl(projectPath, baseUrls.get(projectPath), watches))
    } catch (e) {
        return
    }
    connections.set(projectPath, {es, key})

    es.onmessage = (message) => {
        let ev
        try { ev = JSON.parse(message.data) } catch (e) { return }

        // terminal: EventSource reconnects when a stream merely ends, so
        // leaving this open would re-watch settled keys forever
        if (ev?.status === 'done') {
            closeWatch(projectPath)
            return
        }

        // reported from here rather than from applyEvent, which stays a pure
        // reconciliation of stored state -- and by then the guard has already
        // decided the frame is ours to act on
        if (!applyEvent(projectPath, ev)) return
        if (ev.status === 'discarded') reportDiscarded(ev)
        else if (ev.status === 'superseded') reportSuperseded(projectPath, ev)
    }

    es.onerror = () => closeWatch(projectPath)
}

export function resumeWatching() {
    for (const projectPath of watched) ensureWatching(projectPath)
}

// Writes and a return from hidden are the only triggers. A timer or a route
// change would reopen the connection repeatedly for a queueid that never
// settles.
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    window.addEventListener('beforeunload', closeAllWatches)
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') closeAllWatches()
        else resumeWatching()
    })
}
