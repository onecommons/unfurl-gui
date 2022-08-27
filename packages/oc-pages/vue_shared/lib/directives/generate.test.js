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

test('numbers', () => {
    const resolved = resolve({preset: 'number', len: 100})
    expect(resolved).toContain('0')
    expect(resolved).toContain('1')
    expect(resolved).toContain('2')
    expect(resolved).toContain('3')
    expect(resolved).toContain('4')
    expect(resolved).toContain('5')
    expect(resolved).toContain('6')
    expect(resolved).toContain('7')
    expect(resolved).toContain('8')
    expect(resolved).toContain('9')
    expect(resolved).toMatch(/^\d{100}$/)
})

test('password', () => {
    const password = resolve({ranges: [[48, 57], [65, 90], [97, 122]], len: 15})
    expect(password).toMatch(/^[A-Za-z0-9]{15}$/)
})

test('password preset arg', () => {
    const password = resolve({preset: 'password'})
    expect(password).toMatch(/^[A-Za-z0-9]{15}$/)
})

test('password preset works for ghost', () => {
    for(let i = 0; i < 10; i++) {
        const password = resolve({preset: 'password'})
        expect(password).toMatch(/^(?=.*\d).{10,}$/)
    }
})

// mariadb/mysql
/*
test("password preset doesn't contain backslash", () => {
    for(let i = 0; i < 50; i++) {
        const password = resolve({preset: 'password'})
        expect(password).not.toContain('\\')
    }

})
*/
