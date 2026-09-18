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
 * Apply one event to stored state.
 *
 * The guard is the whole of the difficulty. The event says "A@2 became B", but
 * the user may have saved again since, leaving storage at {A, 3}. Recording
 * {B, 0} there would forget that queueid 3 is still in flight, and the next
 * read would show pre-write state.
 */
export function applyEvent(projectPath, ev) {
    if (!ev?.branch) return false

    const stored = getLastCommit(projectPath, ev.branch)
    if (stored?.commit !== ev.latest_commit) return false
    if (stored.queueid > ev.queueid) return false

    if (ev.status === 'discarded') {
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

        applyEvent(projectPath, ev)
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
