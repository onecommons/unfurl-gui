jest.mock('@gitlab/ui', () => new Proxy({}, {
    get(_target, name) {
        if(typeof name != 'string') return undefined
        if(name == '__esModule') return true
        if(name.endsWith('Directive')) return {}
        const props = new Proxy({}, {get: () => ({validator: () => true})})
        return {name, props, render: () => null}
    },
}))

const ProjectPageHome = require('./index.vue').default

// mounted() reopens the deploy dialog for a ?ts= in the URL, so closing it has
// to clear the parameters, and in one navigation: each starts from $route.query,
// so clearing them one at a time keeps only the last.
it('clears the deploy dialog parameters in one navigation when it closes', () => {
    const self = {
        submitting: false, standalone: true,
        $route: {path: '/p', query: {ts: 'aws', tn: 'x', fn: 'App', bprev: 'v1', env: 'prod', keep: '1'}},
        $router: {replace: jest.fn()},
    }

    ProjectPageHome.methods.clearModalTemplate.call(self)

    expect(self.$router.replace).toHaveBeenCalledTimes(1)
    expect(self.$router.replace.mock.calls[0][0].query).toEqual({keep: '1'})
})
