/*
 * Covers the parts of the port a screenshot cannot: the DOM shape FormItem
 * emits, Space unwrapping formily's Fragment, and ArrayItems add/remove.
 *
 * @gitlab/ui ships untransformed esm and jest does not transpile node_modules,
 * so its widgets are stubbed -- the same workaround file-tree.test.js uses.
 */
jest.mock('@gitlab/ui', () => ({
    GlFormInput: {props: ['value'], render(h) { return h('input', {domProps: {value: this.value}}) }},
    GlFormTextarea: {props: ['value'], render(h) { return h('textarea') }},
    GlFormSelect: {props: ['value', 'options'], render(h) { return h('select') }},
    GlFormCheckbox: {props: ['checked'], render(h) { return h('input', {attrs: {type: 'checkbox'}}) }},
    GlButton: {render(h) { return h('button', {on: this.$listeners}, this.$slots.default) }},
    GlIcon: {props: ['name'], render(h) { return h('span', {attrs: {'data-icon': this.name}}) }},
    GlPopover: {render(h) { return h('div', {class: 'stub-popover'}, this.$slots.default) }}
}))

import { createForm } from '@formily/core'
import { createSchemaField, FormProvider } from '@formily/vue'
import { mount } from '@vue/test-utils'
import { ArrayItems } from './array-items'
import { FormItem, registerExtraRenderer } from './form-item'
import { FormLayout } from './form-layout'
import { Input } from './input'
import { Space } from './space'

const { SchemaField } = createSchemaField({
    components: {FormItem, ArrayItems, Space, Input}
})

function mountForm(schema, formOptions = {}) {
    const form = createForm(formOptions)
    const wrapper = mount({
        components: {FormProvider, FormLayout, SchemaField},
        data: () => ({form, schema}),
        template: `
            <FormProvider :form="form">
              <FormLayout layout="vertical" feedback-layout="popover">
                <SchemaField :schema="schema"/>
              </FormLayout>
            </FormProvider>
        `
    })
    return {form, wrapper}
}

const textField = (extra = {}) => ({
    type: 'object',
    properties: {
        text: {
            type: 'string',
            title: 'a label',
            'x-decorator': 'FormItem',
            'x-component': 'Input',
            'x-component-props': {'data-testid': 'oc-input-x-text'},
            ...extra
        }
    }
})

describe('FormItem', () => {
    it('emits the label, colon and control the stylesheet is written against', () => {
        const {wrapper} = mountForm(textField())
        const item = wrapper.find('.formily-element-form-item')

        expect(item.exists()).toBe(true)
        expect(item.classes()).toEqual(expect.arrayContaining([
            'formily-element-form-item-layout-vertical',
            'formily-element-form-item-feedback-layout-popover'
        ]))
        expect(item.find('.formily-element-form-item-label-content label').text()).toBe('a label')
        expect(item.find('.formily-element-form-item-colon').text()).toBe(':')
        expect(item.find('.formily-element-form-item-control-content-component').exists()).toBe(true)
        // the widget keeps its testid, not the decorator
        expect(item.find('[data-testid="oc-input-x-text"]').exists()).toBe(true)
    })

    it('marks a required field with an asterisk', () => {
        const {wrapper} = mountForm(textField({required: true}))
        expect(wrapper.find('.formily-element-form-item-asterisk').text()).toBe('*')
    })

    it('renders a description through the registered markdown renderer', () => {
        registerExtraRenderer(text => `<em>${text}</em>`)
        try {
            const {wrapper} = mountForm(textField({description: 'see *the docs*'}))
            expect(wrapper.find('.formily-element-form-item-extra').html())
                .toContain('<em>see *the docs*</em>')
        } finally {
            registerExtraRenderer(null)
        }
    })

    it('renders a tooltip trigger only when a tooltip is given', () => {
        const {wrapper: without} = mountForm(textField())
        expect(without.find('.formily-element-form-item-label-tooltip').exists()).toBe(false)

        const {wrapper: with_} = mountForm(textField({
            'x-decorator-props': {tooltip: {render: h => h('b', 'help')}}
        }))
        expect(with_.find('.formily-element-form-item-label-tooltip').exists()).toBe(true)
    })
})

describe('Space', () => {
    it('gives every property of a void field its own item', () => {
        const {wrapper} = mountForm({
            type: 'object',
            properties: {
                space: {
                    type: 'void',
                    'x-component': 'Space',
                    properties: {
                        one: {type: 'string', 'x-decorator': 'FormItem', 'x-component': 'Input'},
                        two: {type: 'string', 'x-decorator': 'FormItem', 'x-component': 'Input'}
                    }
                }
            }
        })
        expect(wrapper.findAll('.formily-element-space-item').length).toBe(2)
    })
})

describe('ArrayItems', () => {
    const arraySchema = {
        type: 'object',
        properties: {
            list: {
                type: 'array',
                'x-decorator': 'FormItem',
                'x-component': 'ArrayItems',
                // the shape oc_inputs.vue's convertProperties builds
                items: {
                    type: 'object',
                    'x-decorator': 'ArrayItems.Item',
                    properties: {
                        space: {
                            type: 'void',
                            'x-component': 'Space',
                            properties: {
                                input: {type: 'string', 'x-decorator': 'FormItem', 'x-component': 'Input'},
                                remove: {
                                    type: 'void',
                                    'x-decorator': 'FormItem',
                                    'x-component': 'ArrayItems.Remove',
                                    'x-component-props': {'data-testid': 'oc-input-x-remove'}
                                }
                            }
                        }
                    }
                },
                properties: {
                    add: {
                        type: 'void',
                        title: 'Add',
                        'x-component': 'ArrayItems.Addition',
                        'x-component-props': {'data-testid': 'oc-input-x-add'}
                    }
                }
            }
        }
    }

    it('keeps the list/item/card wrappers the stylesheet selects on', async () => {
        const {wrapper} = mountForm(arraySchema, {values: {list: [{input: 'first'}]}})
        await wrapper.vm.$nextTick()

        expect(wrapper.find('.formily-element-array-items-list').exists()).toBe(true)
        expect(wrapper.find('.formily-element-array-items-item-inner').exists()).toBe(true)
        expect(wrapper.find('.formily-element-array-items-card').exists()).toBe(true)
    })

    it('appends and removes rows', async () => {
        const {form, wrapper} = mountForm(arraySchema, {values: {list: []}})
        await wrapper.vm.$nextTick()

        await wrapper.find('[data-testid="oc-input-x-add"]').trigger('click')
        expect(form.values.list).toEqual([{}])

        await wrapper.find('[data-testid="oc-input-x-remove"]').trigger('click')
        expect(form.values.list).toEqual([])
    })
})
