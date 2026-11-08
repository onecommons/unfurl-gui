// Saving: what a failure on either side of the write leaves behind.
import {declareAvailableProviders} from 'oc_vue_shared/client_utils/environments'
import {unfurlServerUpdate} from 'oc_vue_shared/client_utils/unfurl-server'
import {patchEnv} from 'oc_vue_shared/client_utils/envvars'
import {fetchProjectInfo} from 'oc_vue_shared/client_utils/projects'
import store from './deployment_template_updates'

jest.mock('oc_vue_shared/client_utils/environments', () => ({declareAvailableProviders: jest.fn()}))
jest.mock('oc_vue_shared/client_utils/unfurl-server', () => ({unfurlServerUpdate: jest.fn()}))
jest.mock('oc_vue_shared/client_utils/envvars', () => ({patchEnv: jest.fn()}))
jest.mock('oc_vue_shared/client_utils/projects', () => ({
    fetchProjectInfo: jest.fn(),
    getOrFetchCurrentBranch: jest.fn(),
    createBranch: jest.fn(),
}))

const {sendUpdateSubrequests, commitPreparedMutations} = store.actions

// jest.config resets mock implementations before each test
beforeEach(() => {
    window.gon = {}
    patchEnv.mockResolvedValue(null)
    fetchProjectInfo.mockResolvedValue({id: 7})
    unfurlServerUpdate.mockResolvedValue({commit: 'abc'})
})

describe('saving an environment', () => {
    const context = () => ({
        state: {
            updateType: 'environment', env: {}, environmentScope: 'prod', projectPath: 'org/dash',
            committedNames: [], commitBranch: 'main', commitMessage: 'Update prod',
        },
        getters: {
            getPatches: {DeploymentEnvironment: {prod: {
                connections: {primary_provider: {name: 'primary_provider', type: 'unfurl.relationships.ConnectsTo.AWSAccount'}},
            }}},
            isCommittedName: () => true,
        },
        rootState: {},
        rootGetters: {lookupVariableByEnvironment: () => null},
        commit: jest.fn(),
    })

    it('records the providers alongside the write', async () => {
        declareAvailableProviders.mockResolvedValue()
        const ctx = context()

        await sendUpdateSubrequests(ctx)

        expect(unfurlServerUpdate).toHaveBeenCalledWith(expect.objectContaining({method: 'update_environment', branch: 'main'}))
        expect(declareAvailableProviders).toHaveBeenCalledWith('org/dash', 'prod', ['unfurl.relationships.ConnectsTo.AWSAccount'])
        expect(ctx.commit).not.toHaveBeenCalledWith('createError', expect.anything(), expect.anything())
    })

    // the write has gone through by then, so the save must not fail with it
    it('reports a refused provider record without failing the save', async () => {
        declareAvailableProviders.mockRejectedValue(new Error('403 Forbidden'))
        const ctx = context()

        await expect(sendUpdateSubrequests(ctx)).resolves.toBeUndefined()

        expect(unfurlServerUpdate).toHaveBeenCalled()
        expect(ctx.commit).toHaveBeenCalledWith('createError', expect.objectContaining({
            message: expect.stringContaining('403 Forbidden'),
            severity: 'major',
        }), {root: true})
    })
})

describe('commitPreparedMutations', () => {
    const context = () => ({
        state: {updateType: 'environment', useBaseState: true},
        getters: {},
        commit: jest.fn(),
        dispatch: jest.fn(),
    })

    it('resets the staged changes once sent', async () => {
        const ctx = context()
        ctx.dispatch.mockResolvedValue('sent')

        await expect(commitPreparedMutations(ctx)).resolves.toBe('sent')

        expect(ctx.commit.mock.calls.map(([name]) => name)).toEqual([
            'setIsCommitting', 'applyMutations', 'normalizePatches', 'resetStagedChanges', 'setIsCommitting',
        ])
        expect(ctx.commit).toHaveBeenLastCalledWith('setIsCommitting', false)
    })

    // otherwise the page warns on every navigation and refuses a new update path
    it('stops committing when sending fails, keeping the changes to retry', async () => {
        const ctx = context()
        ctx.dispatch.mockRejectedValue(new Error('boom'))

        await expect(commitPreparedMutations(ctx)).rejects.toThrow('boom')

        expect(ctx.commit).toHaveBeenLastCalledWith('setIsCommitting', false)
        expect(ctx.commit).not.toHaveBeenCalledWith('resetStagedChanges', expect.anything())
    })
})
