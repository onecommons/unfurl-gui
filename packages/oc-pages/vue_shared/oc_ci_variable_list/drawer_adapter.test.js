import { toStoreVariable, toDrawerVariable } from './drawer_adapter'
import { displayText, types } from './constants'
import { variableTypes } from './constants_19_3'

// The drawer is 19.3-shaped and the store is 15.11-shaped; they agree on no
// field name except `key` and `masked`. Both bugs that reached a user came from
// this mapping, so it is asserted field by field rather than by round trip.

const drawerVariable = {
    id: 7,
    key: 'SOME_KEY',
    value: 'some-value',
    protected: true,
    masked: false,
    hidden: false,
    raw: true,
    description: null,
    environmentScope: 'production',
    variableType: variableTypes.envType,
}

describe('toStoreVariable', () => {
    it('maps every renamed field', () => {
        expect(toStoreVariable(drawerVariable)).toEqual({
            id: 7,
            key: 'SOME_KEY',
            value: 'some-value',
            secret_value: 'some-value',
            protected_variable: true,
            masked: false,
            variable_type: displayText.variableText,
            environment_scope: 'production',
            description: null,
            raw: true,
        })
    })

    // The drawer collects both and the api stores them; forwarding them is what
    // stops a typed description or an unticked "expand references" from being
    // dropped between the form and the request.
    it('forwards description and raw', () => {
        const stored = toStoreVariable({ ...drawerVariable, description: 'why', raw: false })
        expect(stored.description).toBe('why')
        expect(stored.raw).toBe(false)
    })

    // The store's editVariable does `secret_value = value` on whatever it is
    // handed. An object carrying only secret_value therefore loses it, and the
    // PATCH goes out with no value at all -- which the server rejects as
    // "Variables value is invalid". Both must be present and equal.
    it('carries value as well as secret_value', () => {
        const stored = toStoreVariable(drawerVariable)
        expect(stored.value).toBe('some-value')
        expect(stored.secret_value).toBe(stored.value)
    })

    it('survives the assignment editVariable performs', () => {
        const stored = toStoreVariable(drawerVariable)
        stored.secret_value = stored.value // what editVariable does
        expect(stored.secret_value).toBe('some-value')
    })

    it('maps a file variable to the display text the api layer expects', () => {
        const stored = toStoreVariable({ ...drawerVariable, variableType: variableTypes.fileType })
        expect(stored.variable_type).toBe(displayText.fileText)
    })

    it('defaults an absent scope to all environments', () => {
        expect(toStoreVariable({ key: 'K', value: 'v' }).environment_scope).toBe(
            types.allEnvironmentsType,
        )
    })

    it('does not produce undefined for a variable with no value', () => {
        const stored = toStoreVariable({ key: 'K' })
        expect(stored.value).toBe('')
        expect(stored.secret_value).toBe('')
    })
})

describe('toDrawerVariable', () => {
    it('maps a stored variable back', () => {
        expect(toDrawerVariable({
            id: 7,
            key: 'SOME_KEY',
            secret_value: 'some-value',
            protected_variable: true,
            masked: false,
            variable_type: displayText.variableText,
            environment_scope: 'production',
        })).toMatchObject({
            id: 7,
            key: 'SOME_KEY',
            value: 'some-value',
            protected: true,
            masked: false,
            environmentScope: 'production',
            variableType: variableTypes.envType,
        })
    })

    // Rows straight off the API carry `value` and the raw type, not the display
    // string the modal used to write -- an edit must prefill from those too.
    it('reads a row in api shape', () => {
        expect(toDrawerVariable({
            id: 9,
            key: 'FROM_API',
            value: 'api-value',
            protected: true,
            masked: true,
            variable_type: types.fileType,
            environment_scope: '*',
        })).toMatchObject({
            key: 'FROM_API',
            value: 'api-value',
            protected: true,
            masked: true,
            variableType: variableTypes.fileType,
        })
    })

    it('keeps the id so an edit patches rather than creates', () => {
        expect(toDrawerVariable({ id: 42, key: 'K', value: 'v' }).id).toBe(42)
    })
})

describe('round trip', () => {
    it('preserves what the user can see and edit', () => {
        const back = toDrawerVariable(toStoreVariable(drawerVariable))
        expect(back).toMatchObject({
            id: drawerVariable.id,
            key: drawerVariable.key,
            value: drawerVariable.value,
            protected: drawerVariable.protected,
            masked: drawerVariable.masked,
            environmentScope: drawerVariable.environmentScope,
            variableType: drawerVariable.variableType,
        })
    })

    it('preserves a file variable through both directions', () => {
        const file = { ...drawerVariable, variableType: variableTypes.fileType }
        expect(toDrawerVariable(toStoreVariable(file)).variableType).toBe(variableTypes.fileType)
    })
})
