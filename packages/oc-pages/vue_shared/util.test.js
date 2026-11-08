import {
    lookupCloudProviderAlias, lookupCloudProviderShortName, cloudProviderFriendlyName, CLOUD_PROVIDER_TYPES,
    deepClone, generateCardId, userDefaultPath, queryParamVar,
} from './util'

const AWS = 'unfurl.relationships.ConnectsTo.AWSAccount'
const GCP = 'unfurl.relationships.ConnectsTo.GoogleCloudProject'

describe('cloud provider names', () => {
    it.each(['aws', 'AWS', 'AWSAccount', 'Amazon Web Services', AWS, `${AWS}@unfurl.cloud/onecommons/std`])('resolves %p to the AWS type', (key) => {
        expect(lookupCloudProviderAlias(key)).toBe(AWS)
    })

    it('is undefined for an unknown or missing key', () => {
        expect(lookupCloudProviderAlias('Nope')).toBeUndefined()
        expect(lookupCloudProviderAlias(undefined)).toBeUndefined()
    })

    it('has short and friendly names, falling back to self-hosted', () => {
        expect(lookupCloudProviderShortName('gcp')).toBe('GCP')
        expect(lookupCloudProviderShortName('DigitalOcean')).toBe('DO')
        expect(cloudProviderFriendlyName('k8s')).toBe('Kubernetes')
        expect(lookupCloudProviderShortName('Nope')).toBe('Self-Hosted')
        expect(cloudProviderFriendlyName('Nope')).toBe('Self-Hosted')
    })

    it('offers every provider type it has an alias for', () => {
        expect(CLOUD_PROVIDER_TYPES.map(lookupCloudProviderAlias)).toEqual(CLOUD_PROVIDER_TYPES)
        expect(CLOUD_PROVIDER_TYPES).toContain(GCP)
    })
})

describe('deepClone', () => {
    it('copies deeply, cycles included', () => {
        const original = {a: {b: [1, {c: 2}]}}
        original.self = original
        const copy = deepClone(original)
        expect(copy).not.toBe(original)
        expect(copy.a.b[1]).toEqual({c: 2})
        expect(copy.a.b[1]).not.toBe(original.a.b[1])
        expect(copy.self).toBe(copy)
    })

    // structuredClone refuses functions
    it('falls back for what structuredClone refuses', () => {
        const fn = () => 1
        const copy = deepClone({fn, a: {b: 1}})
        expect(copy.fn).toBe(fn)
        expect(copy.a).toEqual({b: 1})
    })
})

it('has a card id and default path', () => {
    expect(generateCardId('a b/c')).toBe('a%20b%2Fc')
    expect(userDefaultPath()).toBe('unfurl.json')
})

describe('queryParamVar', () => {
    const component = (query) => {
        const {tab} = queryParamVar('tab')
        const vm = {$route: {path: '/x', query}, $router: {replace: jest.fn()}}
        return {get: () => tab.get.call(vm), set: v => tab.set.call(vm, v), vm}
    }

    it('reads the query parameter', () => {
        expect(component({tab: 'a'}).get()).toBe('a')
    })

    it('replaces the route with the parameter set or removed', () => {
        const c = component({tab: 'a', other: '1'})
        c.set('b')
        expect(c.vm.$router.replace).toHaveBeenLastCalledWith({path: '/x', query: {tab: 'b', other: '1'}})
        c.set(undefined)
        expect(c.vm.$router.replace).toHaveBeenLastCalledWith({path: '/x', query: {other: '1'}})
    })

    it('does not navigate when nothing changes', () => {
        const c = component({tab: 'a'})
        c.set('a')
        expect(c.vm.$router.replace).not.toHaveBeenCalled()
    })
})
