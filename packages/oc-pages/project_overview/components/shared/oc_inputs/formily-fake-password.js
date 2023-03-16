import { Input, PreviewText } from '@formily/element'
import { connect, mapProps, mapReadPretty } from '@formily/vue'
import { composeExport, transformComponent } from '@formily/element/lib/__builtins__/shared'

import FakePassword from './fake-password.vue'

const TransformFakePassword = transformComponent(FakePassword, {
    change: 'input'
})

const InnerInput = connect(
  TransformFakePassword,
  mapProps({ readOnly: 'readonly' }),
  mapReadPretty(PreviewText.Input)
)

export const Password = composeExport(InnerInput)

export default Password
