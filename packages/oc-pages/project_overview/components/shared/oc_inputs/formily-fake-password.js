import FakePassword from './fake-password.vue'

export const Password = async function () {
    const [element, vue, formilyBuiltin] = await Promise.all([
        import('@formily/element'),
        import('@formily/vue'),
        import('@formily/element/lib/__builtins__/shared')
    ])


    const { Input, PreviewText } = element
    const { connect, mapProps, mapReadPretty } = vue
    const { composeExport, transformComponent } = formilyBuiltin

    const TransformFakePassword = transformComponent(FakePassword, {
        change: 'input'
    })

    const InnerInput = connect(
      TransformFakePassword,
      mapProps({ readOnly: 'readonly' }),
      mapReadPretty(PreviewText.Input)
    )

    return composeExport(InnerInput)
}

export default Password
