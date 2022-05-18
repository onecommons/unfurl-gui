import {tryResolveDirective} from './index.js'

test('non existent directive', () => {
    expect(tryResolveDirective({phoney: ''})).toBeNull()
})

test('multiple keys', () => {
    expect(tryResolveDirective({_generate: '?', phoney: ''})).toBeNull()
})

test('generate password', () => {
    expect(tryResolveDirective({_generate: {preset: 'password'}}))
        .toMatch(/^[\u0021-\u007E]{15,}$/)
})
