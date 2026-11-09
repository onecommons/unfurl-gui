jest.mock('@gitlab/ui', () => new Proxy({}, {
    get(_target, name) {
        if(typeof name != 'string') return undefined
        if(name == '__esModule') return true
        if(name.endsWith('Directive')) return {}
        const props = new Proxy({}, {get: () => ({validator: () => true})})
        return {name, props, render: () => null}
    },
}))
jest.mock('./oc_inputs/index.js', () => ({fields: jest.fn(), schemaFieldComponents: {}, FormProvider: {}, FormLayout: {}, getCustomTooltip: jest.fn(), getUiDirective: jest.fn()}))

const OcInputs = require('./oc_inputs.vue').default

// Each field reports its own status; one invalid field is not every later one.
it('reports each field by its own validity', async () => {
    const field = invalid => ({data: {}, value: 'x', invalid, validate: () => Promise.resolve()})
    const self = {
        propertyPath: [],
        formValues: {first: 'x', second: 'y'},
        form: {fields: {first: field(true), second: field(false)}},
        updateFieldValidation: jest.fn(),
    }

    await OcInputs.methods.validate.call(self)

    expect(self.updateFieldValidation.mock.calls).toEqual([['first', 'error'], ['second', 'valid']])
})
