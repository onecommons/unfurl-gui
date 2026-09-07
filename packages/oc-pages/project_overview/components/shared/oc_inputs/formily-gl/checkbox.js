/*
 * Checkbox adapter. gl-form-checkbox models on `checked`/`input`, so the field
 * value is renamed: leaving `value` in place would collide with gl's own
 * `value` prop (the value emitted when the box is ticked).
 */
import { connect, mapProps, mapReadPretty } from '@formily/vue'
import { GlFormCheckbox } from '@gitlab/ui'
import { PreviewText } from './preview-text'
import { transformComponent } from './shared'

const TransformCheckbox = transformComponent(GlFormCheckbox, {change: 'input'})

export const Checkbox = connect(
    TransformCheckbox,
    mapProps({value: 'checked', readOnly: 'disabled'}),
    mapReadPretty(PreviewText.Input)
)

export default Checkbox
