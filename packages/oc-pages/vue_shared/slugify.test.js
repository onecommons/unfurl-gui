import slugify from './slugify'
function testSlugifyInvocation(text) {
    test(`slugify ${text}`, () => {
        expect(slugify(text)).toMatch(/^[A-Za-z._][A-Za-z0-9._\\-]*$/)
    })

}

testSlugifyInvocation('422a')
test('slugify 422', () => {
  expect(slugify('422')).toEqual('')
})
testSlugifyInvocation('a422')
