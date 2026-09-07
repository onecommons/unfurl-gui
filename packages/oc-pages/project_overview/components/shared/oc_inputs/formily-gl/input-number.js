/*
 * @gitlab/ui has no counterpart to el-input-number, so the stepper column it
 * drew on the right of the field is rebuilt here over gl-form-input. Without it
 * the number field would lose ~38px of chrome that the committed screenshot
 * baselines contain.
 */
import { connect, h, mapProps, mapReadPretty } from '@formily/vue'
import { GlFormInput, GlIcon } from '@gitlab/ui'
import { defineComponent } from 'vue-demi'
import { PreviewText } from './preview-text'
import { stylePrefix } from './shared'

const toNumber = value => {
    if (value === '' || value === null || value === undefined) return undefined
    const parsed = Number(value)
    return Number.isNaN(parsed) ? undefined : parsed
}

const GlInputNumber = defineComponent({
    name: 'GlInputNumber',
    inheritAttrs: false,
    props: {
        value: {},
        step: {default: 1},
        min: {},
        max: {},
        readonly: {type: Boolean, default: false},
        disabled: {type: Boolean, default: false}
    },
    emits: ['change'],
    setup(props, {attrs, emit}) {
        const prefixCls = `${stylePrefix}-input-number`

        const clamp = value => {
            if (value === undefined) return value
            if (props.min !== undefined && value < Number(props.min)) return Number(props.min)
            if (props.max !== undefined && value > Number(props.max)) return Number(props.max)
            return value
        }

        const nudge = direction => {
            if (props.readonly || props.disabled) return
            const current = toNumber(props.value) ?? 0
            emit('change', clamp(current + direction * Number(props.step)))
        }

        const control = (name, icon, direction) => h('span', {
            class: `${prefixCls}__${name}`,
            attrs: {role: 'button', 'aria-label': name},
            on: {click: () => nudge(direction)}
        }, {default: () => [h(GlIcon, {props: {name: icon, size: 12}}, {})]})

        return () => h('div', {
            class: [prefixCls, props.disabled && 'is-disabled']
        }, {
            default: () => [
                h(GlFormInput, {
                    attrs: {
                        ...attrs,
                        type: 'number',
                        value: props.value,
                        readonly: props.readonly,
                        disabled: props.disabled
                    },
                    on: {input: value => emit('change', toNumber(value))}
                }, {}),
                control('increase', 'chevron-up', 1),
                control('decrease', 'chevron-down', -1)
            ]
        })
    }
})

export const InputNumber = connect(
    GlInputNumber,
    mapProps({readOnly: 'readonly'}),
    mapReadPretty(PreviewText.Input)
)

export default InputNumber
