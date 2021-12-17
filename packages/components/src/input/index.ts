import {composeExport, transformComponent} from '../__builtins__/shared'
import {connect, mapProps,} from '@formily/vue'
import {GlFormInput as GlInput} from '@gitlab/ui'


const TransformElInput = transformComponent<{}>(GlInput, {
  change: 'input',
})

const InnerInput = connect(
  TransformElInput,
  mapProps({readOnly: 'readonly'}),
)


export const Input = composeExport(InnerInput, {})

export default Input
