/*
 * Input adapter. oc_inputs.vue selects the textarea through
 * `x-component-props.type = 'textarea'` (as el-input did), so the two
 * @gitlab/ui controls sit behind one widget rather than behind Input.TextArea.
 */
import { connect, h, mapProps, mapReadPretty } from '@formily/vue'
import { GlFormInput, GlFormTextarea } from '@gitlab/ui'
import { defineComponent } from 'vue-demi'
import { PreviewText } from './preview-text'
import { composeExport, passthrough, transformComponent } from './shared'

const GlInput = defineComponent({
    name: 'GlInput',
    inheritAttrs: false,
    props: {type: {default: 'text'}},
    setup(props, ctx) {
        return () => {
            const textarea = props.type === 'textarea'
            const data = passthrough(ctx)
            // gl-form-textarea suppresses the resize grip that el-textarea had
            data.attrs = textarea
                ? {rows: 2, noResize: false, ...data.attrs}
                : {...data.attrs, type: props.type}
            return h(textarea ? GlFormTextarea : GlFormInput, data, ctx.slots)
        }
    }
})

const TransformInput = transformComponent(GlInput, {change: 'input'})

const InnerInput = connect(
    TransformInput,
    mapProps({readOnly: 'readonly'}),
    mapReadPretty(PreviewText.Input)
)

const TextArea = connect(
    InnerInput,
    mapProps(props => ({...props, type: 'textarea'})),
    mapReadPretty(PreviewText.Input)
)

export const Input = composeExport(InnerInput, {TextArea})

export default Input
