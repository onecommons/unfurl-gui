// merge-requests and errors here; unfurl-metadata is a dashboard module
import {listMergeRequests, getOrFetchDefaultBranch} from '../client_utils/projects'
import mergeRequests from './merge-requests'
import errors from './errors'
import unfurlMetadata from '../../dashboard/store/modules/unfurl-metadata'

jest.mock('../client_utils/projects', () => ({listMergeRequests: jest.fn(), getOrFetchDefaultBranch: jest.fn()}))

describe('merge-requests', () => {
    const {actions, getters, mutations} = mergeRequests

    beforeEach(() => { window.gon = {} })

    it('loads the open unfurl-gui merge requests into the default branch', async () => {
        getOrFetchDefaultBranch.mockResolvedValue('main')
        listMergeRequests.mockResolvedValue([{iid: 1}])
        const state = {mergeRequests: []}
        const commit = (name, payload) => mutations[name](state, payload)

        await actions.fetchMergeRequests({commit, rootGetters: {getHomeProjectPath: 'org/dash'}})

        expect(getOrFetchDefaultBranch).toHaveBeenCalledWith('org%2Fdash')
        expect(listMergeRequests).toHaveBeenCalledWith('org%2Fdash', {target: 'main', labels: ['unfurl-gui-mr'], state: 'opened'})
        expect(getters.mergeRequests(state)).toEqual([{iid: 1}])
    })

    it('has none in standalone', async () => {
        window.gon.unfurl_gui = true
        const commit = jest.fn()
        await actions.fetchMergeRequests({commit, rootGetters: {}})
        expect(commit).not.toHaveBeenCalled()
        expect(getters.mergeRequests({mergeRequests: null})).toEqual([])
    })
})

describe('errors', () => {
    const {mutations, getters} = errors
    const view = state => {
        const g = {}
        g.errors = getters.errors(state)
        g.errorsBySeverity = getters.errorsBySeverity(state, g)
        g.hasCriticalErrors = getters.hasCriticalErrors(state, g)
        return g
    }

    it('filters by minimum severity and clears what is shown', () => {
        const state = {errors: [], errorsClearedTo: 0}
        mutations.createError(state, {message: 'a', severity: 'minor'})
        mutations.createError(state, {message: 'b'})
        mutations.createError(state, {message: 'c', severity: 'critical'})

        expect(view(state).errorsBySeverity('major').map(e => e.message)).toEqual(['b', 'c'])
        expect(view(state).hasCriticalErrors).toBe(true)

        mutations.clearErrors(state)
        expect(view(state).errors).toEqual([])
        expect(view(state).hasCriticalErrors).toBe(false)

        mutations.createError(state, {message: 'd', severity: 'minor'})
        expect(view(state).errors.map(e => e.message)).toEqual(['d'])
    })

    it('stores an Error context as its message, and copies any other', () => {
        const state = {errors: [], errorsClearedTo: 0}
        const context = {a: {b: 1}}
        mutations.createError(state, {message: 'x', context: new Error('boom'), extra: 1})
        mutations.createError(state, {message: 'y', context})

        expect(state.errors[0]).toMatchObject({context: 'boom', extra: 1, severity: 'major'})
        expect(state.errors[1].context).toEqual(context)
        expect(state.errors[1].context).not.toBe(context)
    })
})

describe('unfurl-metadata', () => {
    const {mutations, getters} = unfurlMetadata

    it('summarizes the job from the last message', () => {
        const state = {messages: []}
        expect(getters.getJobSummary(state)).toBeNull()
        mutations.pushMessage(state, {target: 'db', operation: 'create', lineNumber: 4})
        expect(getters.getJobSummary(state)).toBeNull()
        mutations.pushMessage(state, {job: {status: 'ok'}})
        expect(getters.getJobSummary(state)).toEqual({job: {status: 'ok'}})
    })

    it('finds the log line of a task', () => {
        const state = {messages: [{target: 'db', operation: 'create', lineNumber: 4}, {target: 'db', operation: 'configure', lineNumber: 9}]}
        expect(getters.taskLineNo(state)({target: 'db', operation: 'configure'})).toBe(9)
        expect(getters.taskLineNo(state)({target: 'vm', operation: 'create'})).toBeUndefined()
    })
})
