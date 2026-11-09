jest.mock('@gitlab/ui', () => new Proxy({}, {
    get(_target, name) {
        if(typeof name != 'string') return undefined
        if(name == '__esModule') return true
        if(name.endsWith('Directive')) return {}
        const props = new Proxy({}, {get: () => ({validator: () => true})})
        return {name, props, render: () => null}
    },
}))

const TemplatesPage = require('./index.vue').default

// A deployment hook returning false makes deployInto resolve false: nothing
// was triggered, so the page must not move on to the deployment's console.
it('stays on the page when a deployment hook cancels the deploy', async () => {
    window.gon = {}
    const self = {
        createFlash: jest.fn(), setUpdateType: jest.fn(), setCommitMessage: jest.fn(),
        triggerSave: jest.fn(() => Promise.resolve(true)),
        deployInto: jest.fn(() => Promise.resolve(false)),
        hasCriticalErrors: false, deploymentParams: {}, durationOfAlerts: 0,
        $route: {query: {}, params: {environment: 'prod', slug: 'app'}},
        $router: {resolve: jest.fn(() => ({href: '/'}))},
        getHomeProjectPath: 'me/dashboard',
        dataWritten: false,
    }
    const replaceState = jest.spyOn(window.history, 'replaceState')
    await TemplatesPage.methods.deploy.call(self, {})
    expect(self.dataWritten).toBe(false)
    expect(replaceState).not.toHaveBeenCalled()
})
