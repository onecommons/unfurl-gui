jest.mock('~/lib/utils/axios_utils', () => ({__esModule: true, default: {get: jest.fn(), patch: jest.fn()}}))

// variablesByPath and the batches are module state
let envvars, axios
beforeEach(() => {
    jest.isolateModules(() => {
        envvars = require('./envvars')
        axios = require('~/lib/utils/axios_utils').default
    })
})

const existing = [
    {id: 1, key: 'TOKEN', value: 'old', environment_scope: 'prod'},
    {id: 2, key: 'TOKEN', value: 'other', environment_scope: 'dev'},
]

it('names a deploy token variable after the project', () => {
    expect(envvars.toDepTokenEnvKey(7)).toBe('_dep_7')
})

describe('fetchEnvironmentVariables', () => {
    it('fetches once and serves copies from the cache', async () => {
        axios.get.mockResolvedValue({data: {variables: existing}})

        const first = await envvars.fetchEnvironmentVariables('org/dash')
        const second = await envvars.fetchEnvironmentVariables('org/dash')

        expect(axios.get).toHaveBeenCalledTimes(1)
        expect(axios.get).toHaveBeenCalledWith('/org/dash/-/variables')
        expect(second).toEqual(first)
    })

    // shareEnvironmentVariables deletes ids and rewrites scopes on what it gets
    it('does not hand out the cached list itself on the first fetch', async () => {
        axios.get.mockResolvedValue({data: {variables: [{id: 1, key: 'A', environment_scope: 'prod'}]}})

        const first = await envvars.fetchEnvironmentVariables('org/dash')
        delete first[0].id
        first[0].environment_scope = 'elsewhere'

        expect(await envvars.fetchEnvironmentVariables('org/dash')).toEqual([{id: 1, key: 'A', environment_scope: 'prod'}])
    })

    it('needs a path', async () => {
        await expect(envvars.fetchEnvironmentVariables()).rejects.toThrow('Need a path')
    })

    it('is undefined when the try variant fails', async () => {
        jest.spyOn(console, 'warn').mockImplementation(() => {})
        axios.get.mockRejectedValue(new Error('403'))
        await expect(envvars.tryFetchEnvironmentVariables('org/dash')).resolves.toBeUndefined()
        console.warn.mockRestore()
    })
})

describe('patchEnv', () => {
    beforeEach(() => {
        axios.get.mockResolvedValue({data: {variables: existing}})
        axios.patch.mockImplementation(async (url, {variables_attributes}) => ({data: {variables: variables_attributes}}))
    })

    it('updates an existing variable by id and creates a new one', async () => {
        await envvars.patchEnv({TOKEN: 'new', $NEW_ONE: 'short'}, 'prod', 'org/dash', 0)

        const [url, {variables_attributes}] = axios.patch.mock.calls[0]
        expect(url).toBe('/org/dash/-/variables')
        expect(variables_attributes).toEqual([
            expect.objectContaining({id: 1, key: 'TOKEN', value: 'new', secret_value: 'new', environment_scope: 'prod', masked: false}),
            expect.objectContaining({key: 'NEW_ONE', value: 'short', environment_scope: 'prod'}),
        ])
        expect(variables_attributes[1]).not.toHaveProperty('id')
    })

    it('masks a single-line value of eight or more characters', async () => {
        await envvars.patchEnv({A: '12345678', B: 'multi\nline value'}, 'prod', 'org/dash', 0)
        const [a, b] = axios.patch.mock.calls[0][1].variables_attributes
        expect(a.masked).toBe(true)
        expect(b.masked).toBe(false)
    })

    it('takes an object value, and skips empty ones', async () => {
        await envvars.patchEnv({A: {value: 'v', protected: true}, B: '', C: 0}, 'prod', 'org/dash', 0)
        const attributes = axios.patch.mock.calls[0][1].variables_attributes
        expect(attributes.map(a => a.key)).toEqual(['A', 'C'])
        expect(attributes[0]).toMatchObject({value: 'v', protected: true})
    })

    it('sends nothing when nothing is set', async () => {
        await expect(envvars.patchEnv({A: ''}, 'prod', 'org/dash', 0)).resolves.toBeNull()
        expect(axios.patch).not.toHaveBeenCalled()
    })

    it('merges calls within the batch period into one request', async () => {
        jest.useFakeTimers()
        try {
            const first = envvars.patchEnv({A: 'a'}, 'prod', 'org/dash')
            const second = envvars.patchEnv({B: 'b'}, 'prod', 'org/dash')
            await jest.advanceTimersByTimeAsync(100)
            await Promise.all([first, second])

            expect(axios.patch).toHaveBeenCalledTimes(1)
            expect(axios.patch.mock.calls[0][1].variables_attributes.map(a => a.key)).toEqual(['A', 'B'])
        } finally {
            jest.useRealTimers()
        }
    })

    it('rejects a name GitLab would refuse', async () => {
        await expect(envvars.patchEnv({'bad-name': 'x'}, 'prod', 'org/dash', 0)).rejects.toThrow('does not match')
    })

    it('needs a path', async () => {
        await expect(envvars.patchEnv({A: 'a'}, 'prod', '', 0)).rejects.toThrow('Need a path')
    })
})

describe('deleteEnvironmentVariables', () => {
    it('destroys every variable in the scope and drops the cache', async () => {
        axios.get.mockResolvedValue({data: {variables: existing}})
        axios.patch.mockResolvedValue({data: {}})

        await envvars.deleteEnvironmentVariables('prod', 'org/dash')
        await envvars.fetchEnvironmentVariables('org/dash')

        expect(axios.patch).toHaveBeenCalledWith('/org/dash/-/variables', {variables_attributes: [{...existing[0], _destroy: true}]})
        expect(axios.get).toHaveBeenCalledTimes(2)
    })

    it('sends nothing for a scope with no variables', async () => {
        axios.get.mockResolvedValue({data: {variables: existing}})
        await envvars.deleteEnvironmentVariables('staging', 'org/dash')
        expect(axios.patch).not.toHaveBeenCalled()
    })

    it('needs a path', async () => {
        jest.spyOn(console, 'warn').mockImplementation(() => {})
        await expect(envvars.deleteEnvironmentVariables('prod')).rejects.toThrow('Need a path')
        console.warn.mockRestore()
    })
})
