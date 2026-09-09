import FakePassword from './fake-password.vue'

export const Password = async function () {
    const [formilyGl, vue] = await Promise.all([
        import('./formily-gl'),
        import('@formily/vue'),
    ])


    // connect comes from formily-gl, not @formily/vue: theirs builds wrappers
    // that read listeners out of $attrs, which @vue/compat empties. Ours opts
    // each one out, and without it the field never sees its own value.
    const { PreviewText, composeExport, connect, transformComponent } = formilyGl
    const { mapProps, mapReadPretty } = vue

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
