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
import {unfurlServerExport, unfurlServerUpdate} from './unfurl-server'
import {closeAllWatches} from './unfurl-server-events'
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

const projectDir = path.join(
    process.env.UNFURL_TEST_TMPDIR || os.tmpdir(),
    `unfurl-events-e2e-${process.pid}`,
)
// `local:` is how the gui addresses a project served off the filesystem
const PROJECT = process.env.TEST_PROJECT_PATH || `local:${projectDir}`

let redisProc
let serverProc
let exportsAfterUpdate = 0

const run = (cmd, args, opts = {}) =>
    execFileSync(cmd, args, {encoding: 'utf8', ...opts}).trim()

// the project actually in play, which is not projectDir when attaching
const gitDir = PROJECT.startsWith('local:') ? PROJECT.slice('local:'.length) : projectDir
const headCommit = () => run('git', ['-C', gitDir, 'rev-parse', BRANCH])

async function waitFor(predicate, {timeout = 60000, label = 'condition'} = {}) {
    const deadline = Date.now() + timeout
    for (;;) {
        if (await predicate()) return true
        if (Date.now() > deadline) throw new Error(`timed out waiting for ${label}`)
        await new Promise((resolve) => setTimeout(resolve, 100))
    }
}

const describeE2E = E2E ? describe : describe.skip

describeE2E('a queued write settled by the real stack', () => {
    jest.setTimeout(180000)

    beforeAll(async () => {
        if (!SERVER_URL) throw new Error('OC_URL must be set to the address of the server')

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

        // Attach to whatever is already up. CI has a standalone gui server with
        // CACHE_REDIS_URL set -- which is what puts the rust proxy in front of
        // it -- so there is nothing for this to start.
        if (await answering()) return

        if (!process.env.TEST_PROJECT_PATH) {
            fs.rmSync(projectDir, {recursive: true, force: true})
            fs.mkdirSync(path.dirname(projectDir), {recursive: true})
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

        Object.assign(window.gon, {unfurl_gui: true, current_username: 'jest'})

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
})