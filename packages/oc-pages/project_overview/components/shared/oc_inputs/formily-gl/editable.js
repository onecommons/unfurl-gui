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
import { defineComponent, getCurrentInstance, onBeforeUnmount, onMounted } from 'vue-demi'
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
        const popoverId = `${triggerId}-popover`

        /*
         * Dismiss on an outside click, which el-popover did by default.
         *
         * `triggers: 'click blur'` is the usual gl-popover idiom for this, but
         * it closes the popover mid-edit here: bv-tooltip only keeps it open
         * when focus moves to another element inside the tip, and a click on a
         * label or on padding has a null relatedTarget, which it reads as focus
         * leaving. This form is mostly labels and padding. So own the rule:
         * anything outside both the trigger and the tip closes it.
         */
        const instance = getCurrentInstance()
        const onDocumentMousedown = event => {
            const tip = document.getElementById(popoverId)
            if (!tip) return
            const trigger = document.getElementById(triggerId)
            // the trigger toggles itself; let its own handler run
            if (trigger?.contains(event.target) || tip.contains(event.target)) return
            // gl-popover's tooltip mixin listens for 'close' on itself and
            // forwards it to the bootstrap-vue popover it wraps; the vendored
            // copy has no root event bus, so this is the way in.
            instance?.proxy?.$refs?.popover?.$emit('close')
        }

        onMounted(() => document.addEventListener('mousedown', onDocumentMousedown))
        onBeforeUnmount(() => document.removeEventListener('mousedown', onDocumentMousedown))

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
                        ref: 'popover',
                        class: [`${prefixCls}-popover`],
                        attrs: {id: popoverId, target: triggerId, triggers: 'click', placement: 'top', title}
                    }, {default: () => [slots.default?.()]})
                ]
            })
        }
    }
}))

export const Editable = {Popover: EditablePopover}

export default Editable
