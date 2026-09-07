/*
 * Port of @formily/element's ArrayItems.
 *
 * vue-slicksort is gone -- nothing enables drag reordering -- but the two divs
 * SlickList and SlickItem rendered are kept, because the ported stylesheet and
 * oc_inputs.vue's scoped rules select on their class names.
 */
import { observer } from '@formily/reactive-vue'
import { h, RecursionField, useField, useFieldSchema } from '@formily/vue'
import { defineComponent } from 'vue-demi'
import { ArrayBase } from './array-base'
import { composeExport, stylePrefix } from './shared'

const isAdditionComponent = schema => schema['x-component']?.indexOf('Addition') > -1

const ArrayItemsInner = observer(defineComponent({
    name: 'FArrayItems',
    setup() {
        const fieldRef = useField()
        const schemaRef = useFieldSchema()
        const prefixCls = `${stylePrefix}-array-items`
        const {getKey, keyMap} = ArrayBase.useKey(schemaRef.value)

        return () => {
            const field = fieldRef.value
            const schema = schemaRef.value
            const dataSource = Array.isArray(field.value) ? field.value.slice() : []

            const renderItems = () => h('div', {class: [`${prefixCls}-list`]}, {
                default: () => dataSource.map((item, index) => {
                    const items = Array.isArray(schema.items)
                        ? schema.items[index] || schema.items[0]
                        : schema.items
                    const key = getKey(item, index)
                    return h(ArrayBase.Item, {key, props: {index, record: item}}, {
                        default: () => h('div', {class: [`${prefixCls}-item-inner`], key}, {
                            default: () => h(RecursionField, {props: {schema: items, name: index}}, {})
                        })
                    })
                })
            })

            const renderAddition = () => schema.reduceProperties((addition, schema) => {
                if (isAdditionComponent(schema)) {
                    return h(RecursionField, {props: {schema, name: 'addition'}}, {})
                }
                return addition
            }, null)

            return h(ArrayBase, {props: {keyMap}}, {
                default: () => h('div', {class: [prefixCls]}, {
                    default: () => [renderItems(), renderAddition()]
                })
            })
        }
    }
}))

const ArrayItemsItem = defineComponent({
    name: 'FArrayItemsItem',
    props: ['type'],
    setup(props, {attrs, slots}) {
        const prefixCls = `${stylePrefix}-array-items`
        return () => h('div', {
            class: [`${prefixCls}-${props.type || 'card'}`],
            attrs: {...attrs}
        }, slots)
    }
})

export const ArrayItems = composeExport(ArrayItemsInner, {
    Item: ArrayItemsItem,
    Index: ArrayBase.Index,
    Addition: ArrayBase.Addition,
    Remove: ArrayBase.Remove,
    useArray: ArrayBase.useArray,
    useIndex: ArrayBase.useIndex,
    useRecord: ArrayBase.useRecord
})

export default ArrayItems
