/*
 * Vue 2's `new Vue({el})` replaced the element; Vue 3's `createApp().mount(el)`
 * renders inside it. That extra wrapper is not inert -- it stops the app root's
 * top margin collapsing into the page, which moved every dashboard page down
 * 12px. So mount into a `display: contents` stand-in and swap the target out
 * for what was rendered.
 *
 * Same approach as the fork's lib/utils/vue3compat/mount_wrapper.js; kept here
 * because these entries are compiled by both builds.
 */
export function mountReplacing(app, element) {
    const wrapper = document.createElement('div')
    wrapper.style.display = 'contents'
    // attached before mounting: components read CSS custom properties on mount
    element.appendChild(wrapper)

    const vm = app.mount(wrapper)

    const rendered = new DocumentFragment()
    rendered.replaceChildren(...wrapper.childNodes)
    element.replaceWith(rendered)

    return vm
}
