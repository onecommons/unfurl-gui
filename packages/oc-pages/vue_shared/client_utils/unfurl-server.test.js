// Tests for unfurlServerExport / unfurlServerUpdate, focused on sessionStorage
// state through the export → update flow and the 409-conflict cleanup.
//
// Three modes selected by env vars (read at module load):
//   - unset             → mock mode: jest.mock returns stub axios; tests set responses inline
//   - OC_URL=...        → gui mode: real axios against `unfurl serve --gui` (no GitLab API)
//   - OC_URL=...
//     GITLAB_TOKEN=...  → cloud mode: real axios against a full backend (GitLab + unfurl server
//                         at the same origin). The presence of GITLAB_TOKEN is what flips
//                         gui→cloud, since gui mode short-circuits auth and doesn't need one.
//
// OC_URL serves a double role: jest.config.js reads it to set jsdom's document
// origin AND we use it here as the axios baseURL. Single value avoids the
// CORS-preflight trap of pointing jsdom at one origin and axios at another.
//
// Live modes also need:
//   TEST_PROJECT_PATH — sacrificial project the test can write branches/commits on
//
// Optional:
//   UNFURL_SERVER_URL_PREFIX — explicit override for the unfurl server path prefix
//     used to build /export, /update_environment, etc. URLs (default for cloud mode
//     is '/services/unfurl-server'; gui mode defaults to '/'). Set this when the
//     backend routes unfurl server somewhere non-standard.
//
// Test bodies assert only on outcomes (return value shape + sessionStorage).
// Mock-only parameter assertions are guarded by `if (MODE === 'mock')`.

// .setupTests.js sets window.gon.unfurl_server_url before this file's imports
// run — necessary because DEFAULT_UNFURL_SERVER_URL is evaluated at module-load
// time. Only overridden when the storage-keys.js default ('/services/unfurl-server')
// is wrong: gui mode needs '/', or UNFURL_SERVER_URL_PREFIX forces a specific value.
// The MODE-dependent gon fields (unfurl_gui, current_username) are set in beforeAll
// below since they're read at call-time, not load-time.
/// OC_URL=http://localhost:8081 TEST_PROJECT_PATH=local:/tmp/unfurl_gui/jest
// user-20231211T213336237Z/dashboard TEST_USERNAME=adam yarn jest packages/oc-pages/vue_shared/client_utils/unfurl-server.test.js --runInBand
jest.mock('~/lib/utils/axios_utils', () => {
    const ocUrl = process.env.OC_URL
    if (ocUrl) {
        const realAxios = jest.requireActual('axios').default || jest.requireActual('axios')
        const instance = realAxios.create({
            baseURL: ocUrl,
            headers: process.env.GITLAB_TOKEN ? {'PRIVATE-TOKEN': process.env.GITLAB_TOKEN} : {},
            // Leave validateStatus at the axios default (throw on non-2xx) so
            // unfurlServerUpdate's 409 catch block actually fires. createBranch
            // sets its own per-request validateStatus override, so it doesn't
            // need a global one here.
        })
        return instance
    }
    return {
        get: jest.fn(),
        post: jest.fn(),
        put: jest.fn(),
        delete: jest.fn(),
    }
})

import axios from '~/lib/utils/axios_utils'
import { unfurlServerExport, unfurlServerUpdate } from './unfurl-server'
import { createBranch, fetchLastCommit, getLastCommit, setLastCommit } from './projects'

const MODE = process.env.OC_URL
    ? (process.env.GITLAB_TOKEN ? 'cloud' : 'gui')
    : 'mock'

const TEST_PROJECT = process.env.TEST_PROJECT_PATH || 'fixtures/test-project'
const TEST_BRANCH  = process.env.TEST_BRANCH       || 'main'

// Default to an add-empty-environment patch dispatched via update_environment —
// safe against any project (no dependency on existing templates/resources) and
// produces a real commit so the update tests can observe sessionStorage advance.
// Each call returns a fresh patch with a unique env name to ensure successive
// updates actually mutate state instead of no-op'ing.
const TEST_METHOD = process.env.TEST_METHOD || 'update_environment'
function makeTestPatch() {
    if (process.env.TEST_PATCH_JSON) return JSON.parse(process.env.TEST_PATCH_JSON)
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    return [{
        __typename: 'DeploymentEnvironment',
        name: `test-env-${suffix}`,
        connections: {},
        instances: {},
    }]
}
const TEST_PATCH = makeTestPatch()

// Live modes hit a real backend whose queue worker can take a few seconds
// to drain; the queued-update→export round-trip in particular runs ~6s.
// Set at module level so it applies to tests registered during describe-time.
if (MODE !== 'mock') jest.setTimeout(30000)

// The rust unfurl-server proxy enqueues every update POST that has a
// `queueid` field and a background worker drains the queue, holding a
// per-project lock while it forwards to the Python backend. Subsequent
// sync writes during that window get 409 "pending batch"; subsequent
// queued writes can get 409 "queueid conflict" if the queue key has
// already been recorded. Tests that fire multiple updates back-to-back
// need to give the worker time to drain in between. The default tolerates
// the rust proxy's batch-window default (UNFURL_BATCH_WINDOW_SECS=5);
// tests run faster when the server is launched with that env var set
// lower (CI uses 1). Mock mode has no real worker, so this is a no-op.
async function letQueueDrain(ms) {
  if (MODE === 'mock') return
  if (ms === undefined) {
    // Worst case: enqueue happens at t=0, worker wakes after batch_window,
    // checks every 250ms, forwards to Python, Python commits (~1s), updates
    // queue key. Empirically 2× the window + 2s covers it; the default
    // batch_window is 5s so we wait 12s, which feels long but reliably
    // catches the worker's writeback.
    const win = parseFloat(process.env.UNFURL_BATCH_WINDOW_SECS || '5')
    ms = Math.max(2000, Math.ceil(win * 1000) * 2 + 2000)
  }
  await new Promise(r => setTimeout(r, ms))
}

beforeAll(() => {
    Object.assign(window.gon, {
        unfurl_gui: MODE === 'gui',
        current_username: process.env.TEST_USERNAME || 'tester',
    })
})

beforeEach(async () => {
    sessionStorage.clear()
    if (MODE === 'mock') {
        axios.get.mockReset()
        axios.post.mockReset()
    } else {
        // Give the rust proxy's batch worker time to drain the prior
        // test's queue items before we start this one. The new flush-on-
        // export server behaviour blocks the *export* path until drain,
        // but POST /update_environment still races: if the worker is mid-
        // batch when this test's first POST fires, the proxy 409s
        // ("pending batch") or fails the queueid check.
        await letQueueDrain()
    }
})

function mockBranchesResponse(commitId = 'commit-A', branch = TEST_BRANCH) {
    // GitLab returns the list of branches; fetchBranches walks it looking for default
    // or the named branch, then fetchLastCommit uses .commit.id + .created_at.
    return {
        data: [{
            name: branch,
            default: true,
            commit: {id: commitId, created_at: '2026-05-14T00:00:00.000Z'},
        }],
    }
}

function mockExportResponse() {
    // Shape doesn't matter for these tests — unfurlServerExport returns it verbatim.
    return {data: {ResourceTemplate: {}, DeploymentTemplate: {}, ApplicationBlueprint: {}}}
}

describe('unfurlServerExport seeds sessionStorage with the branch HEAD commit', () => {
    test('export populates getLastCommit for the branch', async () => {
        if (MODE === 'mock') {
            axios.get.mockImplementation((url) => {
                if (url.includes('/repository/branches')) return Promise.resolve(mockBranchesResponse('commit-A'))
                if (url.includes('/export'))             return Promise.resolve(mockExportResponse())
                return Promise.reject(new Error(`unexpected GET: ${url}`))
            })
        }

        await unfurlServerExport({
            format: 'environments',
            projectPath: TEST_PROJECT,
            branch: TEST_BRANCH,
        })

        const stored = getLastCommit(TEST_PROJECT, TEST_BRANCH)
        expect(stored).toBeTruthy()
        expect(stored.commit).toBeTruthy()
        if (MODE === 'mock') expect(stored.commit).toBe('commit-A')
    })

    test('skipLatestCommit avoids the branches GET', async () => {
        if (MODE === 'mock') {
            axios.get.mockImplementation((url) => {
                if (url.includes('/export')) return Promise.resolve(mockExportResponse())
                return Promise.reject(new Error(`unexpected GET: ${url}`))
            })
        }

        await unfurlServerExport({
            format: 'environments',
            projectPath: TEST_PROJECT,
            branch: TEST_BRANCH,
            skipLatestCommit: true,
        })

        // sessionStorage may still get seeded from response.latest_commit (a separate
        // feature) — what we're checking here is that the upfront GitLab /repository/branches
        // round-trip was skipped.
        if (MODE === 'mock') {
            const branchesCalls = axios.get.mock.calls.filter(([url]) => url.includes('/repository/branches'))
            expect(branchesCalls).toHaveLength(0)
        }
    })
})

describe('unfurlServerUpdate advances sessionStorage to the new commit', () => {
    test('export → update writes the post-commit SHA to sessionStorage', async () => {
        if (MODE === 'mock') {
            axios.get.mockImplementation((url) => {
                if (url.includes('/repository/branches')) return Promise.resolve(mockBranchesResponse('commit-A'))
                if (url.includes('/export'))             return Promise.resolve(mockExportResponse())
                return Promise.reject(new Error(`unexpected GET: ${url}`))
            })
            axios.post.mockImplementation((url) => {
                if (url.includes('/' + TEST_METHOD)) {
                    return Promise.resolve({data: {commit: 'commit-B', queueid: 1, when: '2026-05-14T00:01:00.000Z'}})
                }
                return Promise.reject(new Error(`unexpected POST: ${url}`))
            })
        }

        await unfurlServerExport({
            format: 'environments',
            projectPath: TEST_PROJECT,
            branch: TEST_BRANCH,
        })
        const before = getLastCommit(TEST_PROJECT, TEST_BRANCH)
        expect(before?.commit).toBeTruthy()

        await unfurlServerUpdate({
            method: TEST_METHOD,
            projectPath: TEST_PROJECT,
            branch: TEST_BRANCH,
            patch: TEST_PATCH,
            commitMessage: 'test commit from unfurl-server.test.js',
        })

        const after = getLastCommit(TEST_PROJECT, TEST_BRANCH)
        expect(after?.commit).toBeTruthy()
        // The rust proxy queues updates asynchronously: the response carries the
        // same commit + a higher queueid until the work completes. So "the update
        // was accepted" means either commit advanced (sync) or queueid increased.
        const stateAdvanced = after.commit !== before.commit
            || (after.queueid || 0) > (before.queueid || 0)
        expect(stateAdvanced).toBe(true)
        if (MODE === 'mock') expect(after.commit).toBe('commit-B')

        if (MODE === 'mock') {
            const updateCall = axios.post.mock.calls.find(([url]) => url.includes('/' + TEST_METHOD))
            expect(updateCall).toBeTruthy()
            const body = updateCall[1]
            expect(body.latest_commit).toBe(before.commit)
            expect(body.branch).toBe(TEST_BRANCH)
        }
    })
})

describe('unfurlServerUpdate 409 conflict clears sessionStorage', () => {
    test('on 409, sessionStorage for that branch is cleared', async () => {
        // Pre-seed so the function has a commit to send and a key to clear.
        setLastCommit(TEST_PROJECT, TEST_BRANCH, {commit: 'stale-sha', queueid: 0, when: '2026-05-14T00:00:00.000Z'})
        expect(getLastCommit(TEST_PROJECT, TEST_BRANCH)?.commit).toBe('stale-sha')

        if (MODE === 'mock') {
            axios.post.mockImplementation((url) => {
                if (url.includes('/' + TEST_METHOD)) {
                    return Promise.reject({response: {status: 409, data: {error: 'stale latest_commit'}}})
                }
                return Promise.reject(new Error(`unexpected POST: ${url}`))
            })
        }
        // In live modes, the stale 'stale-sha' is what we just seeded; passing
        // sync:true omits queueid so the server enforces the optimistic lock
        // synchronously (in gui mode the rust proxy would otherwise queue the
        // patch and return a queueid without checking latest_commit).

        await expect(unfurlServerUpdate({
            method: TEST_METHOD,
            projectPath: TEST_PROJECT,
            branch: TEST_BRANCH,
            patch: TEST_PATCH,
            commitMessage: 'forced conflict from unfurl-server.test.js',
            sync: true,
        })).rejects.toBeDefined()

        expect(getLastCommit(TEST_PROJECT, TEST_BRANCH)).toBeFalsy()
    })
})

describe('back-to-back unfurlServerUpdate sends the prior response commit as latest_commit', () => {
    test('second update sees the first update\'s post-commit SHA', async () => {
        if (MODE === 'mock') {
            axios.get.mockImplementation((url) => {
                if (url.includes('/repository/branches')) return Promise.resolve(mockBranchesResponse('commit-A'))
                if (url.includes('/export'))             return Promise.resolve(mockExportResponse())
                return Promise.reject(new Error(`unexpected GET: ${url}`))
            })
            let updateCount = 0
            axios.post.mockImplementation((url) => {
                if (url.includes('/' + TEST_METHOD)) {
                    updateCount += 1
                    const commit = `commit-update-${updateCount}`
                    return Promise.resolve({data: {commit, queueid: updateCount, when: '2026-05-14T00:00:00.000Z'}})
                }
                return Promise.reject(new Error(`unexpected POST: ${url}`))
            })
        }

        await unfurlServerExport({format: 'environments', projectPath: TEST_PROJECT, branch: TEST_BRANCH})
        // Distinct patches so the second update isn't a no-op against the live server
        // (e.g. adding an environment that already exists from the first call).
        await unfurlServerUpdate({method: TEST_METHOD, projectPath: TEST_PROJECT, branch: TEST_BRANCH, patch: makeTestPatch(), commitMessage: 'first'})
        const afterFirst = getLastCommit(TEST_PROJECT, TEST_BRANCH)
        expect(afterFirst?.commit).toBeTruthy()

        // No wait needed: the second POST sends the bumped queueid from
        // the first response, so the rust proxy's inc_queueid takes the
        // queueid-bump path (not the sync-write "pending batch" rejection).
        await unfurlServerUpdate({method: TEST_METHOD, projectPath: TEST_PROJECT, branch: TEST_BRANCH, patch: makeTestPatch(), commitMessage: 'second'})

        if (MODE === 'mock') {
            const updateCalls = axios.post.mock.calls.filter(([url]) => url.includes('/' + TEST_METHOD))
            expect(updateCalls).toHaveLength(2)
            expect(updateCalls[1][1].latest_commit).toBe(afterFirst.commit)
        }

        const afterSecond = getLastCommit(TEST_PROJECT, TEST_BRANCH)
        expect(afterSecond?.commit).toBeTruthy()
        // Same async-vs-sync distinction as the prior describe block.
        const stateAdvanced = afterSecond.commit !== afterFirst.commit
            || (afterSecond.queueid || 0) > (afterFirst.queueid || 0)
        expect(stateAdvanced).toBe(true)
    })
})

describe('unfurlServerExport seeds sessionStorage from response.latest_commit and clears queueid', () => {
    test('export after a queued update advances the commit and resets queueid to 0', async () => {
        if (MODE === 'mock') {
            axios.get.mockImplementation((url) => {
                if (url.includes('/repository/branches')) return Promise.resolve(mockBranchesResponse('commit-A'))
                if (url.includes('/export')) {
                    // Mimic the server returning latest_commit on a successful export.
                    return Promise.resolve({data: {...mockExportResponse().data, latest_commit: 'commit-C'}})
                }
                return Promise.reject(new Error(`unexpected GET: ${url}`))
            })
            axios.post.mockImplementation((url) => {
                if (url.includes('/' + TEST_METHOD)) {
                    // queued response: new commit recorded, queueid > 0
                    return Promise.resolve({data: {commit: 'commit-B', queueid: 5, when: '2026-05-14T00:01:00.000Z'}})
                }
                return Promise.reject(new Error(`unexpected POST: ${url}`))
            })
        }

        // Seed sessionStorage with the branch HEAD so unfurlServerUpdate has a
        // latest_commit to send. The export also loads the project state server-side
        // so the update has data to patch against. Use the environments format
        // since the default patch updates an environment.
        await unfurlServerExport({format: 'environments', projectPath: TEST_PROJECT, branch: TEST_BRANCH})

        await unfurlServerUpdate({
            method: TEST_METHOD,
            projectPath: TEST_PROJECT,
            branch: TEST_BRANCH,
            patch: makeTestPatch(),
            commitMessage: 'queued update for queueid-reset test',
        })

        const afterUpdate = getLastCommit(TEST_PROJECT, TEST_BRANCH)
        expect(afterUpdate?.commit).toBeTruthy()
        if (MODE === 'mock') expect(afterUpdate.queueid).toBe(5)
        // Sanity: the queued update bumped queueid; we'll assert the
        // export below clears it.
        expect((afterUpdate.queueid || 0) > 0).toBe(true)
        const queuedAgainstCommit = afterUpdate.commit

        // Export with queueid > 0: the rust proxy flushes the pending
        // batch, waits for the Python backend's batch_patch to commit,
        // and serves the export against the new HEAD. That exercises:
        //   - rust reading the queue key under CACHE_KEY_PREFIX (matches
        //     Python's writer) — without that we'd never see new_commit
        //   - Python's _update_queue_key writing a plain-utf8 value via
        //     raw redis (not a pickle blob the rust Lua can't parse)
        //   - Python's batch_patch picking the parent-aware fresh
        //     LocalEnv so the recorded new_commit is the parent repo's
        //     post-patch HEAD (not the cached ensemble-subrepo HEAD)
        await unfurlServerExport({format: 'environments', projectPath: TEST_PROJECT, branch: TEST_BRANCH})

        const afterExport = getLastCommit(TEST_PROJECT, TEST_BRANCH)
        expect(afterExport?.commit).toBeTruthy()
        expect(afterExport.queueid || 0).toBe(0)
        // Most important: the export reported a commit *different* from
        // what we sent — i.e. the worker's drain reached the client via
        // the queue-key round-trip. If any link in that chain is
        // broken (wrong repo, wrong cache prefix, pickled value), this
        // assertion fails because the new commit never gets propagated.
        expect(afterExport.commit).not.toBe(queuedAgainstCommit)
        if (MODE === 'mock') expect(afterExport.commit).toBe('commit-C')
    })
})

// gui mode doesn't implement the GitLab branch-create endpoint, so the
// createBranch round-trip can only be exercised in mock and cloud modes.
const describeCreateBranch = MODE === 'gui' ? describe.skip : describe
describeCreateBranch('createBranch seeds sessionStorage so a subsequent unfurlServerUpdate uses it', () => {
    test('createBranch → update reads the seed and advances sessionStorage', async () => {
        const newBranch = `test-claude-${Date.now()}`

        if (MODE === 'mock') {
            axios.get.mockImplementation((url) => {
                // getOrFetchDefaultBranch falls back to fetchBranches; serve a default for the ref.
                if (url.match(/\/repository\/branches\/?$/) || url.includes('/repository/branches?')) {
                    return Promise.resolve(mockBranchesResponse('seed-sha'))
                }
                return Promise.reject(new Error(`unexpected GET: ${url}`))
            })
            axios.post.mockImplementation((url) => {
                if (url.includes('/repository/branches')) {
                    return Promise.resolve({status: 201, data: {name: newBranch, commit: {id: 'seed-sha'}}})
                }
                if (url.includes('/' + TEST_METHOD)) {
                    return Promise.resolve({data: {commit: 'post-update-sha', queueid: 1, when: '2026-05-14T00:00:00.000Z'}})
                }
                return Promise.reject(new Error(`unexpected POST: ${url}`))
            })
        }

        // Note: createBranch takes the *encoded* projectId form (callers historically
        // encode before passing); the seed is decoded back inside before the
        // setLastCommit call so unfurlServerUpdate (which uses unencoded keys) finds it.
        await createBranch(encodeURIComponent(TEST_PROJECT), newBranch)

        const seeded = getLastCommit(TEST_PROJECT, newBranch)
        expect(seeded?.commit).toBeTruthy()
        if (MODE === 'mock') expect(seeded.commit).toBe('seed-sha')

        await unfurlServerUpdate({
            method: TEST_METHOD,
            projectPath: TEST_PROJECT,
            branch: newBranch,
            patch: TEST_PATCH,
            commitMessage: 'after createBranch seed',
        })

        if (MODE === 'mock') {
            const updateCall = axios.post.mock.calls.find(([url]) => url.includes('/' + TEST_METHOD))
            expect(updateCall[1].latest_commit).toBe(seeded.commit)
        }

        const after = getLastCommit(TEST_PROJECT, newBranch)
        expect(after?.commit).toBeTruthy()
        expect(after.commit).not.toBe(seeded.commit)
    })
})

describe('fetchLastCommit short-circuits on a non-zero queueid', () => {
    test('returns the cached commit without hitting the network', async () => {
        setLastCommit(TEST_PROJECT, TEST_BRANCH, {commit: 'queued-sha', queueid: 7, when: '2026-05-14T00:00:00.000Z'})

        if (MODE === 'mock') {
            axios.get.mockImplementation((url) => Promise.reject(new Error(`unexpected GET (should have short-circuited): ${url}`)))
        }

        const [commit, branch, queueid] = await fetchLastCommit(TEST_PROJECT, TEST_BRANCH)
        expect(commit).toBeTruthy()
        expect(branch).toBe(TEST_BRANCH)
        expect(queueid).toBe(7)

        if (MODE === 'mock') {
            expect(commit).toBe('queued-sha')
            expect(axios.get).not.toHaveBeenCalled()
        }
    })
})
