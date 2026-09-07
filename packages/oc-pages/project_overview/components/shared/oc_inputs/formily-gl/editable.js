/*
 * Port of @formily/element's Editable.Popover over gl-popover.
 *
 * Only the Popover variant is ported: ComponentMap maps `object` to
 * `Editable.Popover` and nothing reaches the inline Editable.
 */
import { observer } from '@formily/reactive-vue'
import { uid } from '@formily/shared'
import { h, useField } from '@formily/vue'
import { GlIcon, GlPopover } from '@gitlab/ui'
import { defineComponent } from 'vue-demi'
import { FormBaseItem } from './form-item'
import { stylePrefix } from './shared'

const getParentPattern = fieldRef => {
    const field = fieldRef.value
    return field?.parent?.pattern || field?.form?.pattern
}

const EditablePopover = observer(defineComponent({
    name: 'FEditablePopover',
    setup(props, {attrs, slots}) {
        const fieldRef = useField()
        const prefixCls = `${stylePrefix}-editable`
        const triggerId = `editable-${uid()}`

        return () => {
            const field = fieldRef.value
            const pattern = getParentPattern(fieldRef)
            const title = attrs.title || field.title

            const renderTrigger = () => h(FormBaseItem, {class: [`${prefixCls}-trigger`]}, {
                default: () => h('div', {class: [`${prefixCls}-content`]}, {
                    default: () => [
                        h('span', {class: [`${prefixCls}-preview`]}, {default: () => [title]}),
                        h(GlIcon, {
                            class: [`${prefixCls}-edit-btn`],
                            props: {name: pattern === 'editable' ? 'pencil' : 'comment', size: 12}
                        }, {})
                    ]
                })
            })

            // the popover lives inside its own trigger: it renders into a
            // portal, so nesting it costs no layout and keeps a single root
            return h('span', {class: [prefixCls], attrs: {...attrs, id: triggerId}}, {
                default: () => [
                    renderTrigger(),
                    h(GlPopover, {
                        class: [`${prefixCls}-popover`],
                        attrs: {target: triggerId, triggers: 'click', placement: 'top', title}
                    }, {default: () => [slots.default?.()]})
                ]
            })
        }
    }
}))

export const Editable = {Popover: EditablePopover}

export default Editable
