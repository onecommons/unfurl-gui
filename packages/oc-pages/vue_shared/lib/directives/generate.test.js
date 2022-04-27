import resolve from './generate'


test('one char', () => {
    expect(resolve({ranges: [[33,33]], len: 1})).toEqual('!')
})

test('two chars', () => {
    expect(resolve({ranges: [[33,33]], len: 2})).toEqual('!!')
})

test('alternating chars', () => {
    const resolved = resolve({ranges: [[33,34]], len: 50})
    expect(resolved).toContain('!')
    expect(resolved).toContain('"')
    expect(resolved).toMatch(/^(!|"){50}$/)
})

test('multiple ranges alternating', () => {
    const resolved = resolve({ranges: [[33, 33], [35, 35]], len: 50})
    expect(resolved).toContain('!')
    expect(resolved).toContain('#')
    expect(resolved).toMatch(/^(#|!){50}$/)
})

test('abcd', () => {
    const resolved = resolve({ranges: [[97,100]], len: 50})
    expect(resolved).toContain('a')
    expect(resolved).toContain('b')
    expect(resolved).toContain('c')
    expect(resolved).toContain('d')
    expect(resolved).toMatch(/^[abcd]{50}$/)
})

test('abcdEF', () => {
    const resolved = resolve({ranges: [[97,100], [69, 70]], len: 80})
    expect(resolved).toContain('a')
    expect(resolved).toContain('b')
    expect(resolved).toContain('c')
    expect(resolved).toContain('d')
    expect(resolved).toContain('E')
    expect(resolved).toContain('F')
    let lowercaseCount = 0
    for(let i = 0; i < resolved.length; i++) {
        if(resolved[i].toLowerCase() == resolved[i]) lowercaseCount++
    }
    expect(lowercaseCount).toBeGreaterThan(40)
    
    expect(resolved).toMatch(/^[abcdEF]{80}$/)
})

test('password', () => {
    const password = resolve({ranges: [[33, 126]], len: 15})
    expect(password).toMatch(/^[\u0021-\u007E]{15}$/)
})

test('password preset arg', () => {
    const password = resolve({preset: 'password'})
    expect(password).toMatch(/^[\u0021-\u007E]{15}$/)
})
