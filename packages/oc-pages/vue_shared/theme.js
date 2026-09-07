/*
 * All this used to do besides the mixin was pull in element-ui's theme-chalk
 * and the 33 element-theme-dark overrides. Nothing renders an element-ui
 * component any more, so only the mixin is left.
 *
 * It stamps .gl-dark on every component root. That looks redundant next to
 * body.gl-dark and is not: oc_inputs.vue matches `.oc-inputs >>> .gl-dark ...`,
 * which needs a .gl-dark *inside* .oc-inputs.
 *
 * standalone's own index.html is light (gl-dark-scope, no gl-dark), so this is
 * a no-op there; the fork's layout sets gl-dark for dark-mode users, and the
 * fixture pages set it unconditionally.
 */
export function setupTheme(app) {
    if(!document.querySelector('body.gl-dark')) return

    function addDark(el) {
        el.classList?.add('gl-dark')
    }

    app.mixin({
        watch: {
            $el() {
                addDark(this.$el)
            }
        },
        mounted() {
            addDark(this.$el)
        }
    })
}
