/*
 * Minimal stand-in for @formily/element's PreviewText.
 *
 * Deliberately small: nothing in oc_inputs.vue puts a field in `readPretty`
 * (a `const` property becomes `x-read-only`, which is a different pattern), so
 * this only exists to give the adapters below a `mapReadPretty` target.
 */
import { isArr, isValid } from '@formily/shared'
import { h } from '@formily/vue'
import {defineAdapter, stylePrefix} from './shared'

const prefixCls = `${stylePrefix}-preview-text`

const text = value => (isValid(value) && value !== '' ? value : 'N/A')

const Input = defineAdapter({
    name: 'FPreviewTextInput',
    props: ['value'],
    setup(props, {attrs}) {
        return () => h('span', {class: [prefixCls], style: attrs.style}, {
            default: () => [text(props.value)]
        })
    }
})

const Select = defineAdapter({
    name: 'FPreviewTextSelect',
    props: ['value', 'options', 'multiple'],
    setup(props, {attrs}) {
        return () => {
            const values = props.multiple
                ? (isArr(props.value) ? props.value : [])
                : (isValid(props.value) ? [props.value] : [])
            const labels = values.map(
                value => props.options?.find(o => o?.value == value)?.label ?? value
            )
            return h('span', {class: [prefixCls], style: attrs.style}, {
                default: () => [labels.length ? labels.join(', ') : 'N/A']
            })
        }
    }
})

export const PreviewText = {Input, Select}

export default PreviewText
