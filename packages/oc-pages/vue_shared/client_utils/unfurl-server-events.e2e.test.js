/*
 * A real queued write, settled by the real stack, notified over the real
 * stream. Nothing here is planted.
 *
 * `unfurl serve` starts the rust proxy itself once CACHE_REDIS_URL is set --
 * its presence selects the redis cache (serve.py:157) and that is what the
 * proxy is gated on (serve.py:2560) -- so one server gives proxy in front of
 * Python. The POST is a real update_environment, the queueid is the server's,
 * the commit is one Python actually made, and the event comes off /events.
 *
 * Opt-in, because it spawns a server and writes to a git repo:
 *
 *   OC_URL=http://127.0.0.1:27411 yarn test:e2e
 *
 * OC_URL is required and does double duty, as it does in unfurl-server.test.js:
 * jest.config reads it for jsdom's document origin, and the server is started on
 * its port. They must match. An absolute per-project override would be the
 * obvious alternative and is a trap -- doXhr routes every request through an
 * iframe whenever an override is set, and `await ufsvIFrame.ready` never
 * resolves under jsdom, so the whole test hangs rather than failing.
 *
 * Redis and the server are spawned only when nothing is already answering at
 * OC_URL, and the project is created only when TEST_PROJECT_PATH names none.
 * So it attaches to a server that is already up -- which is how CI runs it,
 * alongside the other JEST_PRE_CYPRESS suite against the standalone gui.
 *
 *   TEST_PROJECT_PATH   attach to this project instead of creating one
 *   UNFURL_CMD          default `unfurl`
 *   UNFURL_TEST_TMPDIR  where a created project goes
 */
import {execFileSync, spawn} from 'child_process'
import {webcrypto} from 'crypto'
import fs from 'fs'
import http from 'http'
import os from 'os'
import path from 'path'
import {ReadableStream as NodeReadableStream, TransformStream as NodeTransformStream,
    WritableStream as NodeWritableStream} from 'stream/web'
import * as nodeTimers from 'timers'
import {TextEncoder as NodeTextEncoder, TextDecoder as NodeTextDecoder} from 'util'
import {MessageChannel as NodeMessageChannel, MessagePort as NodeMessagePort} from 'worker_threads'

import axios from '~/lib/utils/axios_utils'
import {DEFAULT_UNFURL_SERVER_URL} from '../storage-keys'
import {unfurlServerExport, unfurlServerUpdate} from './unfurl-server'
import {closeAllWatches, setEventErrorReporter} from './unfurl-server-events'
import {fetchLastCommit, getLastCommit} from './projects'

// undici is a Node library; jsdom removes or replaces most of what it builds on
for (const [name, value] of Object.entries({
    TextEncoder: NodeTextEncoder, TextDecoder: NodeTextDecoder,
    ReadableStream: NodeReadableStream, WritableStream: NodeWritableStream,
    TransformStream: NodeTransformStream,
    MessageChannel: NodeMessageChannel, MessagePort: NodeMessagePort,
    crypto: webcrypto,
})) {
    if (typeof global[name] === 'undefined') global[name] = value
}
// forced: jsdom's setTimeout returns a number where undici calls .unref()
for (const name of ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
    'setImmediate', 'clearImmediate']) {
    global[name] = nodeTimers[name]
}
for (const target of [global.performance, global.window?.performance]) {
    if (target && typeof target.markResourceTiming !== 'function') {
        target.markResourceTiming = () => {}
    }
}

// OC_URL is the gate as well as the address: jest.config reads it for jsdom's
// document origin, and without it there is nothing to talk to.
const E2E = Boolean(process.env.OC_URL)
const UNFURL_CMD = process.env.UNFURL_CMD || 'unfurl'
const BRANCH = 'main'

// Randomised: a fixed redis port collides with whatever else is up, and each
// side's teardown then shuts down the other's instance.
const REDIS_PORT = String(20000 + Math.floor(Math.random() * 20000))
// Not randomised: jsdom's origin is fixed when jest launches, and the request
// has to be same-origin to avoid the iframe path described above.
const SERVER_URL = process.env.OC_URL || ''
const SERVER_PORT = SERVER_URL.split(':').pop()

// realpath, because the server registers a gui-mode project under its resolved
// working_dir (to_json.get_local_project_path) and looks `local:` ids up by
// exact string. On macOS /tmp and /var/folders are symlinks into /private, so
// an unresolved path here matches no registered project and every request 500s
// inside get_project_url's `assert not project_id.startswith("local:")`.
const tmpRoot = (() => {
    const dir = process.env.UNFURL_TEST_TMPDIR || os.tmpdir()
    fs.mkdirSync(dir, {recursive: true})
    return fs.realpathSync(dir)
})()
const projectDir = path.join(tmpRoot, `unfurl-events-e2e-${process.pid}`)
// `local:` is how the gui addresses a project served off the filesystem
const PROJECT = process.env.TEST_PROJECT_PATH || `local:${projectDir}`

let redisProc
let serverProc
let exportsAfterUpdate = 0
// what a store would have been handed; see setEventErrorReporter below
const reported = []

const run = (cmd, args, opts = {}) =>
    execFileSync(cmd, args, {encoding: 'utf8', ...opts}).trim()

// the project actually in play, which is not projectDir when attaching
const gitDir = PROJECT.startsWith('local:') ? PROJECT.slice('local:'.length) : projectDir
const headCommit = () => run('git', ['-C', gitDir, 'rev-parse', BRANCH])
// commit subjects since a revision, newest first -- which of a batch's
// requests actually committed
const subjectsSince = from =>
    run('git', ['-C', gitDir, 'log', '--format=%s', `${from}..${BRANCH}`])
        .split('\n').filter(Boolean)

async function waitFor(predicate, {timeout = 60000, label = 'condition'} = {}) {
    const deadline = Date.now() + timeout
    for (;;) {
        if (await predicate()) return true
        if (Date.now() > deadline) throw new Error(`timed out waiting for ${label}`)
        await new Promise((resolve) => setTimeout(resolve, 100))
    }
}

/*
 * One raw subscription, for one watch, collected until the terminal frame.
 *
 * The module's own client cannot express this: its watch set holds one entry
 * per branch, so it only ever watches the newest queueid. Built the way
 * eventsUrl builds it so both hit the same endpoint.
 */
function collectFrames(commit, queueid, {timeout = 120000} = {}) {
    // the trailing replace is eventsUrl's: the base url is '/' in gui mode, and
    // `//events` parses as protocol-relative -- a request to the host `events`
    const url = (`${DEFAULT_UNFURL_SERVER_URL}/events`
        + `?auth_project=${encodeURIComponent(PROJECT)}`
        + `&watch=${encodeURIComponent(`${BRANCH}:${commit}:${queueid}`)}`
    ).replace(/^\/+/, '/')

    return new Promise((resolve, reject) => {
        const es = new global.EventSource(url)
        const frames = []
        const settle = (fn, arg) => { clearTimeout(timer); es.close(); fn(arg) }
        const timer = setTimeout(
            () => settle(reject, new Error(`no done frame for queueid ${queueid}`)), timeout)

        es.onmessage = (message) => {
            const frame = JSON.parse(message.data)
            if (frame.status === 'done') return settle(resolve, frames)
            frames.push(frame)
        }
        // the server closing after `done` would otherwise land here as a
        // reconnect; we have already closed by then
        es.onerror = () => settle(reject, new Error(`events failed for queueid ${queueid}`))
    })
}

const describeE2E = E2E ? describe : describe.skip

describeE2E('a queued write settled by the real stack', () => {
    jest.setTimeout(180000)

    beforeAll(async () => {
        if (!SERVER_URL) throw new Error('OC_URL must be set to the address of the server')

        /*
         * Gui mode, asserted rather than assumed. A `local:` id resolves in no
         * other mode -- only gui registers those keys (serve.py:466) -- so this
         * is the mode check as well as a path check, and the whole file rests
         * on it. What it protects is TEST_PROJECT_PATH: point that at a real
         * cloud project and the server behind it is not in gui mode, and the
         * rollback assertions below quietly mean the opposite of what they say.
         */
        if (!PROJECT.startsWith('local:')) {
            throw new Error(`these tests require a gui-mode server: ${PROJECT} is not a local: project`)
        }

        // undici is a Node library and will not resolve a relative url; the
        // module builds one because the base url is '/' in gui mode. Doing the
        // resolution a browser would do is the whole of this subclass.
        const RealEventSource = require('undici').EventSource
        global.EventSource = class extends RealEventSource {
            constructor(url, ...rest) {
                super(new URL(url, SERVER_URL).href, ...rest)
                global.__lastEventSource = this
            }
        }

        const answering = () => new Promise((resolve) => {
            const req = http.get(`${SERVER_URL}/version`, (res) => {
                res.resume()
                resolve(res.statusCode < 500)
            })
            req.on('error', () => resolve(false))
            req.setTimeout(2000, () => { req.destroy(); resolve(false) })
        })

        /*
         * Start a stack only when nothing is already up. CI has a standalone
         * gui server with CACHE_REDIS_URL set -- which is what puts the rust
         * proxy in front of it -- so there is nothing for this to start.
         *
         * Not an early return: everything below this block is setup both modes
         * need. Returning here skipped it for the attached path, which is the
         * one CI takes -- so the export counter was never installed and test
         * one's `expect(exportsAfterUpdate).toBe(0)`, the whole point of its
         * name, could not fail there.
         */
        if (!await answering()) {
            if (!process.env.TEST_PROJECT_PATH) {
                fs.rmSync(projectDir, {recursive: true, force: true})
                run(UNFURL_CMD, ['init', projectDir])
            }

            redisProc = spawn('redis-server',
                ['--port', REDIS_PORT, '--save', '', '--appendonly', 'no'], {stdio: 'ignore'})
            await waitFor(() => {
                try { return run('redis-cli', ['-p', REDIS_PORT, 'ping']) === 'PONG' } catch (e) { return false }
            }, {timeout: 15000, label: 'redis'})

            serverProc = spawn(UNFURL_CMD, ['serve', '--gui', '--port', SERVER_PORT], {
                cwd: projectDir,
                stdio: 'ignore',
                env: {
                    ...process.env,
                    CACHE_REDIS_URL: `redis://127.0.0.1:${REDIS_PORT}/0`,
                    UNFURL_BATCH_WINDOW_SECS: '1',
                    UNFURL_HOME: '',
                },
            })

            await waitFor(answering, {timeout: 90000, label: 'unfurl serve'})
        }

        Object.assign(window.gon, {unfurl_gui: true, current_username: 'jest'})

        // stands in for the store the app registers here, so the frame's error
        // can be checked the way the user would see it
        setEventErrorReporter(payload => reported.push(payload))

        // count exports issued after the update: with the blocking read also
        // working, a passing test proves nothing unless the export did not happen
        axios.interceptors.request.use((config) => {
            if (String(config.url).includes('/export')) exportsAfterUpdate += 1
            return config
        })
    }, 180000)

    afterAll(async () => {
        closeAllWatches()

        /*
         * SIGTERM, not SIGKILL. `unfurl serve` runs the rust proxy as a child
         * and reaps it from a SIGTERM handler installed for exactly this
         * (serve.py:2467), because Python would otherwise exit without running
         * its finally block. SIGKILL skips the handler and orphans the proxy
         * still holding the port, which the next run sees as a port conflict
         * rather than as the leak it is.
         *
         * SIGINT also works -- KeyboardInterrupt unwinds into the same finally
         * -- but only when the child's disposition is default. A background job
         * of a non-interactive shell inherits SIGINT ignored, so it is the less
         * portable choice for a harness.
         */
        if (serverProc) {
            serverProc.kill('SIGTERM')
            await new Promise((resolve) => setTimeout(resolve, 2000))
        }
        if (redisProc) {
            try { run('redis-cli', ['-p', REDIS_PORT, 'shutdown', 'nosave']) } catch (e) { /* expected */ }
            redisProc.kill('SIGKILL')
        }
        // only what this spawned; an attached server and its project are not ours
        if (!process.env.TEST_PROJECT_PATH) {
            fs.rmSync(projectDir, {recursive: true, force: true})
        }
    })

    it('advances to the commit the repo actually ends up at, without an export', async () => {
        // seeds sessionStorage with the project's real latest_commit
        await unfurlServerExport({projectPath: PROJECT, branch: BRANCH, format: 'environments'})

        const before = getLastCommit(PROJECT, BRANCH)
        expect(before?.commit).toBe(headCommit())

        const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
        const patch = [{
            __typename: 'DeploymentEnvironment',
            name: `jest-env-${suffix}`,
            connections: {},
            instances: {},
        }]

        // a real write. unfurlServerUpdate stores {commit, queueid} and calls
        // ensureWatching itself, so the subscription is part of the write path
        const result = await unfurlServerUpdate({
            method: 'update_environment',
            projectPath: PROJECT,
            branch: BRANCH,
            patch,
            commitMessage: 'jest e2e',
        })

        expect(result.queueid).toBeGreaterThan(0)
        expect(getLastCommit(PROJECT, BRANCH)).toMatchObject({
            commit: before.commit,
            queueid: result.queueid,
        })

        exportsAfterUpdate = 0

        // the batch worker forwards to Python, Python commits, the proxy updates
        // the queue key, /events reports it, and the client applies it
        await waitFor(() => getLastCommit(PROJECT, BRANCH)?.queueid === 0,
            {label: 'the event to settle the write'})

        const after = getLastCommit(PROJECT, BRANCH)
        expect(after.commit).not.toBe(before.commit)
        // the assertion that matters: the event carried the commit the repo is at
        expect(after.commit).toBe(headCommit())
        expect(exportsAfterUpdate).toBe(0)

        /*
         * The terminal `done` frame has to actually close the connection, or
         * EventSource reconnects and re-watches settled keys forever. Only a
         * real stream proves this -- a stub closes because it was written to.
         * CLOSED === 2.
         */
        await waitFor(() => global.__lastEventSource?.readyState === 2,
            {timeout: 15000, label: 'the connection to close on done'})
    })

    /*
     * A second client that read the commit from /branches rather than /export,
     * writing straight after the first. /branches still reports the pre-write
     * commit -- the first write is queued, not applied -- so both clients name
     * the same latest_commit and land on the one queue key.
     *
     * The second is refused: it offers queueid 0 against a commit that already
     * has one recorded, which the proxy calls a stale queueid. It does not
     * silently join the batch, and it is a plain CONFLICT rather than
     * WRITE_DISCARDED, so nothing clears the second client's stored queueid for
     * it -- that error is the caller's to handle.
     *
     * What matters here is the first client: a competing rejected write must
     * not disturb the event that settles it.
     */
    it('settles the first client while a second is refused as stale', async () => {
        await unfurlServerExport({projectPath: PROJECT, branch: BRANCH, format: 'environments'})
        const base = getLastCommit(PROJECT, BRANCH).commit

        // the second client's own read of the commit, by the other route
        const [viaBranches] = await fetchLastCommit(PROJECT, BRANCH)
        expect(viaBranches).toBe(base)

        const mkPatch = (tag) => [{
            __typename: 'DeploymentEnvironment',
            name: `race-${tag}-${Date.now()}`, connections: {}, instances: {},
        }]

        const first = await unfurlServerUpdate({
            method: 'update_environment', projectPath: PROJECT, branch: BRANCH,
            patch: mkPatch('first'), commitMessage: 'first client',
        })
        expect(first.queueid).toBeGreaterThan(0)

        // posted raw: a second browser would not share this one's sessionStorage
        const refused = await axios.post(
            `/update_environment?auth_project=${encodeURIComponent(PROJECT)}`,
            {branch: BRANCH, latest_commit: base, patch: mkPatch('second'), commit_msg: 'second client', queueid: 0},
            {headers: {'Content-Type': 'application/json'}},
        ).then((res) => ({status: res.status, data: res.data}),
            (e) => ({status: e.response?.status, data: e.response?.data}))

        expect(refused.status).toBe(409)
        expect(refused.data).toMatchObject({code: 'CONFLICT'})

        exportsAfterUpdate = 0

        await waitFor(() => getLastCommit(PROJECT, BRANCH)?.queueid === 0,
            {label: "the first client's write to settle"})

        const after = getLastCommit(PROJECT, BRANCH)
        expect(after.commit).not.toBe(base)
        expect(after.commit).toBe(headCommit())
        expect(exportsAfterUpdate).toBe(0)
    })

    /*
     * Three writes inside one batch window, the middle one rejected: A commits,
     * B fails, C never runs.
     *
     * What the stream says is not what the repo did. In gui mode
     * `_rollback_batch` leaves A's commit alone -- there is no remote to carry
     * it anywhere, so the local repo is the record rather than a staging area
     * -- yet every write on the key is reported as lost.
     *
     * The three share one key: it is per (project, branch, latest_commit) and
     * they were all composed against `base`. What separates them is the
     * counter. A and B queued before C did, so by the time anything settles the
     * counter has passed them and each is told `superseded` -- its patch was
     * composed without the writes that followed it, which is true whatever the
     * batch goes on to do. Only the last queueid waits for the result, and that
     * is the one that gets the failure.
     *
     * Watched on separate connections because parse_watch_set rejects a
     * repeated (branch, commit) outright (routes.rs:1010), and these differ
     * only by queueid. B's watch is left out: it is A's case a second time.
     */
    async function failingBatch(bPatch) {
        reported.length = 0

        await unfurlServerExport({projectPath: PROJECT, branch: BRANCH, format: 'environments'})
        const base = getLastCommit(PROJECT, BRANCH).commit
        expect(base).toBe(headCommit())

        const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
        const env = name => [{
            __typename: 'DeploymentEnvironment', name, connections: {}, instances: {},
        }]
        const write = (patch, commitMessage) => unfurlServerUpdate({
            method: 'update_environment', projectPath: PROJECT, branch: BRANCH,
            patch, commitMessage,
        })

        // Sequential, and none of them waits on the backend: each is enqueued
        // and answered with its queueid, which the next one then sends. So they
        // take consecutive slots on one queue key -- that they end up in one
        // *batch* is the window's doing.
        const a = await write(env(`batch-a-${suffix}`), 'a')
        const b = await write(bPatch, 'b')
        const c = await write(env(`batch-c-${suffix}`), 'c')

        expect(b.queueid).toBe(a.queueid + 1)
        expect(c.queueid).toBe(a.queueid + 2)
        // all three are queued against `base`; nothing has advanced the commit
        expect(getLastCommit(PROJECT, BRANCH)).toMatchObject({commit: base, queueid: c.queueid})

        const [stale, failed] = await Promise.all(
            [a.queueid, c.queueid].map(q => collectFrames(base, q)),
        )

        /*
         * A's watch gets both frames, and is not closed by the first. Every
         * queueid below the counter is superseded, so a watch that closed
         * there would leave only the highest to hear the batch fail -- the
         * client that wrote *first* would be told "recompose" and never learn
         * its write was lost. The supersession is still sent once rather than
         * repeated every poll.
         */
        expect(stale.map(f => f.status)).toEqual(['superseded', 'discarded'])
        expect(stale[0]).toMatchObject({
            branch: BRANCH,
            latest_commit: base,
            queueid: a.queueid,
            // the counter, not a watch -- C's write is what moved it past A's
            observed: c.queueid,
        })
        // A's own queueid, so a client can tell "my write was in the batch that
        // died" from "a batch died"; the batch's is alongside as batch_queueid
        expect(stale[1]).toMatchObject({
            code: 'WRITE_DISCARDED',
            queueid: a.queueid,
            batch_queueid: c.queueid,
        })

        expect(failed).toHaveLength(1)
        expect(failed[0]).toMatchObject({
            status: 'discarded',
            code: 'WRITE_DISCARDED',
            branch: BRANCH,
            latest_commit: base,
            queueid: c.queueid,
        })

        /*
         * The client itself watched only its newest queueid: the watch set is
         * one entry per branch, so A's and B's were replaced as each write
         * stored its own. The discarded frame clears that entry rather than
         * advancing it -- the stored commit stays at `base` while the repo has
         * moved to A's commit, so this tab is now stale and its next write
         * 409s. Better than waiting on a commit that is never coming.
         */
        await waitFor(() => getLastCommit(PROJECT, BRANCH)?.queueid === 0,
            {label: "the client's queued write to be discarded"})
        expect(getLastCommit(PROJECT, BRANCH)).toMatchObject({commit: base, queueid: 0})

        /*
         * A committed, B was refused, C never ran -- and gui mode kept A.
         *
         * This and `rolled_back: false` below are the two assertions gui mode
         * decides: `_rolls_back_a_failed_batch` is false here, so nothing
         * undoes what landed. Against a non-gui server both flip together --
         * `rolled_back: true`, and no commit survives -- while `applied` still
         * names index 0, because `_annotate_failed_request` runs at the moment
         * of failure and `batch_patch` rolls back after it. Non-empty `applied`
         * with `rolled_back: true` is a coherent pairing meaning "index 0
         * committed, then everything was undone"; it just isn't this one.
         */
        expect(subjectsSince(base)).toEqual(['a'])

        return failed[0].error
    }

    /*
     * B names `secrets`, which `_apply_environment_patch` refuses as a reserved
     * folder name (endpoints.py:1901) by *returning* an error response. That is
     * the only kind `_annotate_failed_request` sees, and it is what puts
     * `failed_request` and `applied` in the body -- which request stopped the
     * batch, how many never ran, and which had already committed.
     */
    it('names the request that stopped the batch and the one that had landed', async () => {
        const error = await failingBatch([{
            __typename: 'DeploymentEnvironment', name: 'secrets', connections: {}, instances: {},
        }])

        // `count` is the assertion that they batched at all: three requests in
        // one /batch_patch. A window too short to hold them reads 1 or 2 here.
        expect(error).toMatchObject({
            status: 400,
            code: 'BAD_REQUEST',
            rolled_back: false,
            failed_request: {endpoint: 'update_environment', index: 1, count: 3, skipped: 1},
            applied: [{endpoint: 'update_environment', index: 0}],
        })
        expect(error.message).toMatch(/reserved name: "secrets"/)

        // and the user is told, with Python's own message rather than the
        // proxy's summary of it. Nothing threw: the promise this write returned
        // resolved the moment the proxy queued the patch.
        expect(reported).toHaveLength(1)
        expect(reported[0]).toMatchObject({
            severity: 'critical',
            message: expect.stringMatching(/reserved name: "secrets"/),
            context: {failed_request: {index: 1, count: 3, skipped: 1}},
        })
    })

    /*
     * The other half of the shape, and the half no unit test can plant: a
     * patch that *raises* rather than returning an error. A DeploymentEnvironment
     * entry with no `name` is a KeyError, caught per request and annotated like
     * a returned error is, so one body says both which request raised and what
     * had already committed. These used to be disjoint -- an annotated error
     * with no traceback, or a traceback with no idea which request raised.
     *
     * `details` is the field that matters downstream: errors.js keys the
     * traceback panel on it starting with "Traceback", so this is the
     * difference between a rendered stack and a dead field.
     */
    it('carries the python traceback of a batch that raised', async () => {
        const error = await failingBatch([{
            __typename: 'DeploymentEnvironment', connections: {}, instances: {},
        }])

        // the backend's code, not the frame's. A flattened payload would
        // collide here, which is why the nesting exists.
        expect(error).toMatchObject({status: 500, code: 'INTERNAL_ERROR', rolled_back: false})
        expect(error.details).toMatch(/^Traceback/)
        expect(error.details).toMatch(/KeyError/)
        // annotated despite having raised, so the traceback and the position
        // arrive together rather than one failure carrying half the story
        expect(error).toMatchObject({
            failed_request: {endpoint: 'update_environment', index: 1, count: 3, skipped: 1},
            applied: [{endpoint: 'update_environment', index: 0}],
        })

        // what errors.js turns into the traceback panel
        expect(reported).toHaveLength(1)
        expect(reported[0].context.details.startsWith('Traceback')).toBe(true)
    })
})
