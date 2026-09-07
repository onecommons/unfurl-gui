/*
 * Port of @formily/element's ArrayBase over @gitlab/ui.
 *
 * MoveUp/MoveDown and SortHandle are dropped: nothing in oc_inputs.vue's
 * schemas renders them, and the handle only existed to drive vue-slicksort.
 */
import { clone, isValid, uid } from '@formily/shared'
import { ExpressionScope, Fragment, h, useField, useFieldSchema } from '@formily/vue'
import { GlButton } from '@gitlab/ui'
import { defineComponent, inject, onBeforeUnmount, provide, ref, toRefs } from 'vue-demi'
import { composeExport, stylePrefix } from './shared'

const ArrayBaseSymbol = Symbol('ArrayBaseContext')
const ItemSymbol = Symbol('ItemContext')

const useArray = () => inject(ArrayBaseSymbol, null)

const useIndex = index => toRefs(inject(ItemSymbol)).index ?? ref(index)

const useRecord = record => toRefs(inject(ItemSymbol)).record ?? ref(record)

const isObjectValue = schema => {
    if (Array.isArray(schema?.items)) return isObjectValue(schema.items[0])
    return schema?.items?.type === 'array' || schema?.items?.type === 'object'
}

const useKey = schema => {
    let keyMap = isObjectValue(schema) ? new WeakMap() : []
    onBeforeUnmount(() => { keyMap = null })
    return {
        keyMap,
        getKey: (record, index) => {
            if (keyMap instanceof WeakMap) {
                if (!keyMap.has(record)) keyMap.set(record, uid())
                return `${keyMap.get(record)}-${index}`
            }
            if (!keyMap[index]) keyMap[index] = uid()
            return `${keyMap[index]}-${index}`
        }
    }
}

const getDefaultValue = (defaultValue, schema) => {
    if (isValid(defaultValue)) return clone(defaultValue)
    if (Array.isArray(schema?.items)) return getDefaultValue(defaultValue, schema.items[0])
    switch (schema?.items?.type) {
        case 'array': return []
        case 'boolean': return true
        case 'date': return ''
        case 'datetime': return ''
        case 'number': return 0
        case 'object': return {}
        case 'string': return ''
        default: return null
    }
}

const ArrayBaseInner = defineComponent({
    name: 'ArrayBase',
    props: {
        disabled: {type: Boolean, default: false},
        keyMap: {type: [WeakMap, Array]}
    },
    setup(props, {slots}) {
        const field = useField()
        const schema = useFieldSchema()
        provide(ArrayBaseSymbol, {field, schema, props, keyMap: props.keyMap})
        return () => h(Fragment, {}, slots)
    }
})

const ArrayBaseItem = defineComponent({
    name: 'ArrayBaseItem',
    props: ['index', 'record'],
    setup(props, {slots}) {
        provide(ItemSymbol, props)
        return () => h(ExpressionScope, {
            props: {value: {$record: props.record, $index: props.index}}
        }, {default: () => h(Fragment, {}, slots)})
    }
})

const ArrayBaseIndex = defineComponent({
    name: 'ArrayBaseIndex',
    setup(props, {attrs}) {
        const index = useIndex()
        return () => h('span', {
            class: `${stylePrefix}-array-base-index`,
            attrs
        }, {default: () => [`#${index.value + 1}.`]})
    }
})

const ArrayBaseAddition = defineComponent({
    name: 'ArrayBaseAddition',
    props: ['title', 'method', 'defaultValue'],
    setup(props, {attrs}) {
        const self = useField()
        const array = useArray()
        return () => {
            if (!array || array.field.value.pattern !== 'editable') return null
            return h(GlButton, {
                class: `${stylePrefix}-array-base-addition`,
                attrs: {...attrs},
                on: {
                    click: () => {
                        if (array.props?.disabled) return
                        const defaultValue = getDefaultValue(props.defaultValue, array.schema.value)
                        if (props.method === 'unshift') array.field?.value.unshift(defaultValue)
                        else array.field?.value.push(defaultValue)
                    }
                }
            }, {default: () => [self.value.title || props.title]})
        }
    }
})

const ArrayBaseRemove = defineComponent({
    name: 'ArrayBaseRemove',
    props: ['title', 'index'],
    setup(props, {attrs}) {
        const indexRef = useIndex(props.index)
        const base = useArray()
        return () => {
            if (base?.field.value.pattern !== 'editable') return null
            return h(GlButton, {
                class: `${stylePrefix}-array-base-remove`,
                attrs: {category: 'tertiary', icon: 'remove', 'aria-label': 'remove', ...attrs},
                on: {
                    click: e => {
                        e.stopPropagation()
                        if (Array.isArray(base?.keyMap)) base.keyMap.splice(indexRef.value, 1)
                        base?.field.value.remove(indexRef.value)
                    }
                }
            }, {default: () => [props.title]})
        }
    }
})

export const ArrayBase = composeExport(ArrayBaseInner, {
    Index: ArrayBaseIndex,
    Item: ArrayBaseItem,
    Addition: ArrayBaseAddition,
    Remove: ArrayBaseRemove,
    useArray,
    useIndex,
    useKey,
    useRecord
})

export default ArrayBase
