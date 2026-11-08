import {reactive, isReactive} from 'vue'
import {freeze, deepFreeze, sleep} from './misc'

describe('freeze', () => {
    it('freezes a plain object and returns it', () => {
        const obj = {a: 1}
        expect(freeze(obj)).toBe(obj)
        expect(Object.isFrozen(obj)).toBe(true)
    })

    it('leaves nested objects unfrozen', () => {
        const obj = {nested: {a: 1}}
        freeze(obj)
        expect(Object.isFrozen(obj.nested)).toBe(false)
    })

    it('does not freeze a reactive proxy', () => {
        const proxy = reactive({a: 1})
        expect(freeze(proxy)).toBe(proxy)
        expect(Object.isFrozen(proxy)).toBe(false)
        proxy.a = 2
        expect(proxy.a).toBe(2)
    })

    it.each([null, undefined, 0, 'str'])('passes %p through', (value) => {
        expect(freeze(value)).toBe(value)
    })

    it('keeps a frozen object out of reactive()', () => {
        const obj = freeze({a: 1})
        expect(isReactive(reactive(obj))).toBe(false)
    })
})

describe('deepFreeze', () => {
    it('freezes every nested object and array', () => {
        const obj = {a: {b: {c: 1}}, list: [{d: 2}], n: null}
        expect(deepFreeze(obj)).toBe(obj)
        expect(Object.isFrozen(obj)).toBe(true)
        expect(Object.isFrozen(obj.a)).toBe(true)
        expect(Object.isFrozen(obj.a.b)).toBe(true)
        expect(Object.isFrozen(obj.list)).toBe(true)
        expect(Object.isFrozen(obj.list[0])).toBe(true)
    })

    it('stops at a reactive child without freezing it', () => {
        const child = reactive({a: 1})
        const obj = {child}
        deepFreeze(obj)
        expect(Object.isFrozen(obj)).toBe(true)
        child.a = 2
        expect(child.a).toBe(2)
    })
})

describe('sleep', () => {
    it('resolves after the period', async () => {
        jest.useFakeTimers()
        try {
            let done = false
            const p = sleep(100).then(() => { done = true })
            jest.advanceTimersByTime(99)
            await Promise.resolve()
            expect(done).toBe(false)
            jest.advanceTimersByTime(1)
            await p
            expect(done).toBe(true)
        } finally {
            jest.useRealTimers()
        }
    })
})
