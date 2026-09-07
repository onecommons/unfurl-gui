/*
 * Synthetic inputs schema covering every entry in oc_inputs.vue's ComponentMap.
 * Grown from the sketch that was in src/pages/form/test-cases.js.
 *
 * FileSelector is deliberately absent: it sits inside a standalone-only
 * preprocessor block and is compiled out of this build. (Careful writing that
 * directive literally in a comment -- webpack-preprocessor-loader parses it
 * and then fails looking for the closing directive.)
 */
export const inputsSchema = {
  type: 'object',
  properties: {
    text:        { type: 'string', title: 'text' },                       // Input
    textarea:    { type: 'string', title: 'textarea', input_type: 'textarea' }, // Input (textarea)
    number:      { type: 'number', title: 'number' },                     // InputNumber
    checkbox:    { type: 'boolean', title: 'checkbox' },                  // Checkbox
    select:      { type: 'string', title: 'select', enum: ['A', 'B', 'C'] }, // Select
    password:    { type: 'string', title: 'password', sensitive: true },  // FakePassword
    withDefault: { type: 'string', title: 'withDefault', default: 'defaultValue' },
    readonly:    { type: 'string', title: 'readonly', const: 'readonly' },
    array: {                                                              // ArrayItems
      type: 'array', title: 'array',
      items: { type: 'string' }
    },
    object: {                                                             // Editable.Popover
      type: 'object', title: 'object',
      properties: { nested: { type: 'string', title: 'nested' } }
    },
    environment: {                                                        // key/value ArrayItems
      type: 'object', title: 'environment',
      additionalProperties: { type: 'string' },
      default: {}
    }
  }
}

export const card = {
  name: 'fixture',
  title: 'Fixture',
  type: 'FixtureType',
  properties: Object.keys(inputsSchema.properties).map(name => ({ name, value: null }))
}
