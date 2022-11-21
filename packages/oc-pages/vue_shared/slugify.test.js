import slugify from './slugify'

function expectMatchingSlug(text) {
    expect(slugify(text)).toMatch(/^[A-Za-z._][A-Za-z0-9._\\-]*$/)
}
function testSlugifyInvocation(text) {
    test(`slugify ${text}`, () => {
        expectMatchingSlug(text)
    })

}

testSlugifyInvocation('422a')
testSlugifyInvocation('a422')

test('slugify 422', () => {
    expect(slugify('422')).toEqual('')
})

test('unfurl slugify behavior (title)', () => {
    const s = 'Google Cloud Platform - Compute Engine 2'
    expectMatchingSlug(s)
    expect(slugify(s)).toEqual('google-cloud-platform-compute-engine-2')
})

test('unfurl slugify behavior (name)', () => {
    const s = 'google-cloud-platform---compute-engine-2'
    expectMatchingSlug(s)
    expect(slugify(s)).toEqual('google-cloud-platform-compute-engine-2')
})
