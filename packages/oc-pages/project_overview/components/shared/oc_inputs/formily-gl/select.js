/*
 * Select adapter. gl-form-select is a native <select> taking {value, text}
 * options, so formily's dataSource ({label, value}, or bare strings from a
 * schema `enum`) is normalised on the way in.
 */
import {h, mapProps, mapReadPretty} from '@formily/vue'
import { GlFormSelect } from '@gitlab/ui'
import { PreviewText } from './preview-text'
import {connect, defineAdapter, passthrough, transformComponent} from './shared'

const normalize = options => (options || []).map(option => (
    typeof option === 'object' && option !== null
        ? {...option, text: option.text ?? option.label ?? option.value}
        : {value: option, text: option}
))

const GlSelect = defineAdapter({
    name: 'GlSelect',
    inheritAttrs: false,
    props: ['options'],
    setup(props, ctx) {
        return () => {
            const data = passthrough(ctx)
            data.attrs = {...data.attrs, options: normalize(props.options)}
            return h(GlFormSelect, data, ctx.slots)
        }
    }
})

const TransformSelect = transformComponent(GlSelect, {change: 'input'})

export const Select = connect(
    TransformSelect,
    mapProps({dataSource: 'options', loading: true}),
    mapReadPretty(PreviewText.Select)
)

export default Select
