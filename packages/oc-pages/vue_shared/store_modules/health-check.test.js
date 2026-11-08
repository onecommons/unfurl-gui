import {XhrIFrame} from '../client_utils/crossorigin-xhr'

jest.mock('../client_utils/crossorigin-xhr', () => ({XhrIFrame: jest.fn()}))

// the iframe is created at import, and state is a module-level object
let healthCheck, doXhr
beforeEach(() => {
    doXhr = jest.fn()
    XhrIFrame.mockImplementation(() => ({doXhr}))
    jest.isolateModules(() => { healthCheck = require('./health-check').default })
})

const {now} = Date
afterEach(() => { Date.now = now })

function context() {
    const state = healthCheck.state
    const ctx = {
        state,
        commit: jest.fn((name, payload) => healthCheck.mutations[name](state, payload)),
        dispatch: jest.fn(),
        rootGetters: {
            lookupDeployPath: () => ({name: 'environments/prod/app'}),
            deploymentItemDirect: () => ({pipeline: {variables: {WORKFLOW: 'deploy'}}}),
        },
    }
    return ctx
}

const deployment = (extra = {}) => ({
    name: 'app', status: 1, workflow: 'deploy', healthCheckUrl: 'https://app/health',
    deployTime: new Date('2026-01-01T00:00:00Z'), readinessEstimate: 120, ...extra,
})
const environment = {name: 'prod'}

describe('addUrlPoll', () => {
    beforeEach(() => jest.spyOn(console, 'warn').mockImplementation(() => {}))
    afterEach(() => console.warn.mockRestore())

    // readiness_estimate is in seconds
    it('is pending while within its readiness estimate, with the time left as its eta', async () => {
        Date.now = () => new Date('2026-01-01T00:01:00Z').getTime()
        const ctx = context()

        await healthCheck.actions.addUrlPoll(ctx, {deployment: deployment(), environment})

        expect(ctx.state.statuses.app).toBe('PENDING')
        expect(ctx.state.etas.app).toBe(60)
        expect(ctx.dispatch).toHaveBeenCalledWith('startPollingLoop')
    })

    it('is likely up once past it', async () => {
        Date.now = () => new Date('2026-01-01T00:05:00Z').getTime()
        const ctx = context()
        await healthCheck.actions.addUrlPoll(ctx, {deployment: deployment(), environment})
        expect(ctx.state.statuses.app).toBe('LIKELY_UP')
        expect(ctx.state.etas.app).toBe(0)
    })

    it('assumes five minutes without an estimate', async () => {
        Date.now = () => new Date('2026-01-01T00:04:00Z').getTime()
        const ctx = context()
        await healthCheck.actions.addUrlPoll(ctx, {deployment: deployment({readinessEstimate: undefined}), environment})
        expect(ctx.state.statuses.app).toBe('PENDING')
        expect(ctx.state.etas.app).toBe(60)
    })

    it('polls the health check url through the iframe', async () => {
        const ctx = context()
        doXhr.mockResolvedValue({data: 'ok'})
        await healthCheck.actions.addUrlPoll(ctx, {deployment: deployment(), environment})
        await expect(ctx.state.urlPolls.app()).resolves.toBe('ok')
        expect(doXhr).toHaveBeenCalledWith('GET', 'https://app/health')
    })

    it.each([
        ['no health check url', {healthCheckUrl: null}],
        ['an undeploy', {workflow: 'undeploy'}],
        ['a failed deployment', {status: 3}],
    ])('skips %s, clearing any earlier poll', async (_, extra) => {
        const ctx = context()
        await healthCheck.actions.addUrlPoll(ctx, {deployment: deployment(extra), environment})
        expect(ctx.commit).toHaveBeenCalledWith('clearPollingStateFor', 'app')
        expect(ctx.state.urlPolls).not.toHaveProperty('app')
    })

    it('skips an incomplete dashboard item', async () => {
        const ctx = context()
        await healthCheck.actions.addUrlPoll(ctx, {deployment: deployment(), environment: null})
        expect(ctx.commit).toHaveBeenCalledWith('clearPollingStateFor', 'app')
    })

    it('does not restart a poll already running', async () => {
        const ctx = context()
        ctx.state.statuses.app = 'PENDING'
        await healthCheck.actions.addUrlPoll(ctx, {deployment: deployment(), environment})
        expect(ctx.commit).not.toHaveBeenCalledWith('_addUrlPoll', expect.anything())
    })
})

describe('the polling loop', () => {
    it('completes a deployment whose health check answers', async () => {
        jest.useFakeTimers()
        try {
            const ctx = context()
            healthCheck.mutations._addUrlPoll(ctx.state, {url: 'https://app/health', name: 'app', initialStatus: 'PENDING'})
            doXhr.mockResolvedValue({data: 'ok'})

            healthCheck.actions.startPollingLoop(ctx)
            await jest.advanceTimersByTimeAsync(10)

            expect(ctx.state.statuses.app).toBe('COMPLETE')
            expect(ctx.state.urlPolls).not.toHaveProperty('app')
        } finally {
            jest.useRealTimers()
        }
    })

    it('keeps one that does not answer pending', async () => {
        jest.useFakeTimers()
        try {
            const ctx = context()
            healthCheck.mutations._addUrlPoll(ctx.state, {url: 'https://app/health', name: 'app', initialStatus: 'LIKELY_UP'})
            doXhr.mockRejectedValue(new Error('down'))

            healthCheck.actions.startPollingLoop(ctx)
            await jest.advanceTimersByTimeAsync(10)

            expect(ctx.state.statuses.app).toBe('PENDING')
        } finally {
            jest.useRealTimers()
        }
    })
})

describe('getters', () => {
    const {getters, mutations} = {getters: null, mutations: null}

    it('reads the polling status', () => {
        const state = healthCheck.state
        healthCheck.mutations.markUrlPending(state, 'app')
        expect(healthCheck.getters.pollingStatus(state)('app')).toBe('PENDING')
        healthCheck.mutations.completeUrlPolling(state, 'app')
        expect(healthCheck.getters.pollingStatus(state)('app')).toBe('COMPLETE')
    })

    it('counts the eta down', () => {
        const state = healthCheck.state
        state.etas.app = 90.5
        healthCheck.mutations.decrimentEtas(state, 1000)
        expect(healthCheck.getters.deploymentEta(state)('app')).toBe(89)
        healthCheck.mutations.decrimentEtas(state, 200000)
        expect(healthCheck.getters.deploymentEta(state)('app')).toBe(0)
    })

    it.each([[0, 'now'], [1, '1 second'], [45, '45 seconds'], [125, '2 minutes, 5 seconds'], [120, '2 minutes']])('formats an eta of %ps as %p', (eta, text) => {
        const g = {deploymentEta: () => eta}
        expect(healthCheck.getters.formattedDeploymentEta({}, g)('app')).toBe(text)
    })

    void getters; void mutations
})
