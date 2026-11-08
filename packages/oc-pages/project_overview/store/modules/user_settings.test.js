import userSettings from './user_settings'

const {mutations, actions, getters} = userSettings

beforeEach(() => localStorage.clear())

// actions call each other through dispatch; route it back into them
function context(state, rootGetters = {}) {
    const ctx = {state, rootGetters}
    ctx.commit = jest.fn((name, payload) => mutations[name](state, payload))
    ctx.dispatch = jest.fn((name, payload) => actions[name](ctx, payload))
    return ctx
}

describe('loading', () => {
    it('reads the user\'s saved settings', () => {
        localStorage.setItem('us-me', JSON.stringify({lastUsedEnvironmentList: [{cloud: 'aws', environmentName: 'prod'}], acknowledged: {intro: '1'}}))
        const state = userSettings.state()
        mutations.initUserSettings(state, {username: 'me'})
        expect(state.lastUsedEnvironmentList).toEqual([{cloud: 'aws', environmentName: 'prod'}])
        expect(state.acknowledged).toEqual({intro: '1'})
    })

    it('starts empty for a user with nothing saved', () => {
        const state = userSettings.state()
        mutations.initUserSettings(state, {username: 'new'})
        expect(state).toEqual({lastUsedEnvironmentList: [], acknowledged: {}})
    })
})

describe('the last used environment', () => {
    const environments = ['prod', 'staging', 'gcp-dev']
    const rootGetters = {lookupEnvironment: name => environments.includes(name) ? {name} : undefined}

    it('remembers one environment per cloud and saves it', async () => {
        const state = userSettings.state()
        const ctx = context(state)

        await actions.updateLastUsedEnvironment(ctx, {lastUsedEnvironment: {cloud: 'aws', environmentName: 'prod'}, username: 'me'})
        await actions.updateLastUsedEnvironment(ctx, {lastUsedEnvironment: {cloud: 'gcp', environmentName: 'gcp-dev'}, username: 'me'})
        await actions.updateLastUsedEnvironment(ctx, {lastUsedEnvironment: {cloud: 'aws', environmentName: 'staging'}, username: 'me'})

        expect(state.lastUsedEnvironmentList).toEqual([
            {cloud: 'aws', environmentName: 'staging'},
            {cloud: 'gcp', environmentName: 'gcp-dev'},
        ])
        expect(JSON.parse(localStorage.getItem('us-me')).lastUsedEnvironmentList).toEqual(state.lastUsedEnvironmentList)
    })

    it('offers the remembered environment for a cloud', () => {
        const state = {lastUsedEnvironmentList: [{cloud: 'aws', environmentName: 'prod'}, {cloud: 'gcp', environmentName: 'gcp-dev'}]}
        const lookup = getters.getLastUsedEnvironment(state, {}, {}, rootGetters)
        expect(lookup({cloud: 'aws'})).toBe('prod')
        expect(lookup({cloud: 'gcp'})).toBe('gcp-dev')
        expect(lookup({cloud: 'azure'})).toBeUndefined()
    })

    it('does not offer one that has since been deleted', () => {
        const state = {lastUsedEnvironmentList: [{cloud: 'aws', environmentName: 'gone'}]}
        expect(getters.getLastUsedEnvironment(state, {}, {}, rootGetters)({cloud: 'aws'})).toBeUndefined()
    })
})

describe('acknowledgements', () => {
    it('records one, keeping the others, and saves as the current user', () => {
        const state = {lastUsedEnvironmentList: [], acknowledged: {intro: '1'}}
        actions.acknowledge(context(state, {getUsername: 'me'}), 'tour')

        expect(getters.isAcknowledged(state)('intro')).toBe(true)
        expect(getters.isAcknowledged(state)('tour')).toBe(true)
        expect(getters.isAcknowledged(state)('other')).toBe(false)
        expect(JSON.parse(localStorage.getItem('us-me')).acknowledged).toEqual({intro: '1', tour: '1'})
    })

    it('is not acknowledged before settings load', () => {
        expect(getters.isAcknowledged({lastUsedEnvironmentList: []})('intro')).toBeFalsy()
    })
})

it('exposes the settings themselves', () => {
    const state = userSettings.state()
    expect(getters.getUserSettings(state)).toBe(state)
    expect(getters.userSettings(state)).toBe(state)
})
