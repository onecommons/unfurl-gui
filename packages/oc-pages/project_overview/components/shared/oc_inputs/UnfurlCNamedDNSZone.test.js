jest.mock('@gitlab/ui', () => new Proxy({}, {
    get(_target, name) {
        if(typeof name != 'string') return undefined
        if(name == '__esModule') return true
        if(name.endsWith('Directive')) return {}
        return {name, render: () => null}
    },
}))
jest.mock('oc_vue_shared/client_utils/crossorigin-xhr', () => ({XhrIFrame: jest.fn()}))

const UnfurlCNamedDNSZone = require('./UnfurlCNamedDNSZone.vue').default
const subdomain = UnfurlCNamedDNSZone.computed.subdomain

it('reads the subdomain from the nearest ancestor that has one', () => {
    const parent = {name: 'parent', properties: [{name: 'subdomain', value: 'www'}]}
    const self = {card: {name: 'dns', properties: []}, getDependent: name => (name == 'dns' ? parent : undefined)}
    expect(subdomain.call(self)).toBe('www')
})

// Before the user has wired the zone into an app, no ancestor has a subdomain.
it('has no subdomain when no ancestor has one', () => {
    const self = {card: {name: 'dns', properties: []}, getDependent: () => undefined}
    expect(subdomain.call(self)).toBeUndefined()
})
