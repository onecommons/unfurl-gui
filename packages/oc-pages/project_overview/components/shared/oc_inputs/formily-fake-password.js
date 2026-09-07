import FakePassword from './fake-password.vue'

export const Password = async function () {
    const [formilyGl, vue] = await Promise.all([
        import('./formily-gl'),
        import('@formily/vue'),
    ])


    const { PreviewText, composeExport, transformComponent } = formilyGl
    const { connect, mapProps, mapReadPretty } = vue

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
