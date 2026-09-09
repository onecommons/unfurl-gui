/*
 * Helpers copied from @formily/element/lib/__builtins__/shared, rewritten
 * against @formily/vue's `h` so they work unchanged on Vue 2.7 and Vue 3.
 */
import { connect as formilyConnect, FragmentComponent, h } from '@formily/vue'
import { merge } from '@formily/shared'
import { defineComponent, isVue2, toRaw } from 'vue-demi'

/*
 * @formily/vue's Vue 3 Fragment renders this.$slots.default?.call(...), but
 * @vue/compat keeps $slots in the Vue 2 array form for any component that has
 * not opted out of legacy render functions -- an array has no .call, so every
 * Space and RecursionField threw. RENDER_FUNCTION has to stay enabled globally
 * (@gitlab/ui's vendored bootstrap-vue is written against it), so opt out this
 * one component instead. Set here because everything in this directory imports
 * from shared.
 */
FragmentComponent.compatConfig = {RENDER_FUNCTION: false}

// The class prefix stays `formily-element`: oc_inputs.vue's scoped rules and
// the committed screenshot baselines are keyed on it.
export const stylePrefix = 'formily-element'

/*
 * Everything in this directory is written against Vue 3's attrs semantics: a
 * listener arrives as onXxx inside $attrs and is forwarded by spreading it.
 * @vue/compat reproduces Vue 2 instead -- it strips onXxx back out of $attrs,
 * because there listeners lived in $listeners -- and formily's own connect
 * wrappers read them from attrs too, so the field's change handler never
 * reached the widget. The flag has to stay on globally (@gitlab/ui's vendored
 * bootstrap-vue reads $listeners everywhere), so opt out per component.
 */
const VUE3_ATTRS = {INSTANCE_LISTENERS: false}

const optOut = component =>
    Object.assign(component, {compatConfig: {...component.compatConfig, ...VUE3_ATTRS}})

export const defineAdapter = options => defineComponent({compatConfig: VUE3_ATTRS, ...options})

// connect() builds two more wrappers of its own around the component; each of
// those has to opt out as well, or the listeners are already gone by the time
// they reach ours.
export const connect = (target, ...mappers) =>
    optOut(formilyConnect(mappers.reduce((t, mapper) => optOut(mapper(t)), target)))

export function composeExport(s0, s1) {
    return Object.assign(s0, s1)
}

const noop = () => {}

/*
 * Re-emits a widget's own event under the name formily's field binding
 * listens for (formily sends `change`, gl-form-* emit `input`).
 */
export const transformComponent = function(tag, transformRules, defaultProps) {
    if (isVue2) {
        return defineAdapter({
            setup(props, {attrs, slots, listeners}) {
                return () => {
                    const data = {attrs: {...attrs}, on: {...listeners}}
                    if (transformRules) {
                        Object.keys(transformRules).forEach(extract => {
                            data.on[transformRules[extract]] = listeners[extract] || noop
                        })
                    }
                    if (defaultProps) data.attrs = merge(defaultProps, data.attrs)
                    return h(tag, data, slots)
                }
            }
        })
    }

    return defineAdapter({
        setup(props, {attrs, slots}) {
            return () => {
                let data = {...attrs}
                if (transformRules) {
                    Object.keys(transformRules).forEach(extract => {
                        const event = transformRules[extract]
                        data[`on${event[0].toUpperCase()}${event.slice(1)}`] =
                            attrs[`on${extract[0].toUpperCase()}${extract.slice(1)}`] || noop
                    })
                }
                if (defaultProps) data = merge(defaultProps, data)
                return h(tag, data, slots)
            }
        }
    })
}

/*
 * Vue 2 delivers a component's listeners separately; Vue 3 delivers them inside
 * attrs as onXxx. Spreading this into `h`'s data covers both.
 */
export const passthrough = ctx => (
    isVue2 ? {attrs: {...ctx.attrs}, on: {...ctx.listeners}} : {attrs: {...ctx.attrs}}
)

export function isVnode(element) {
    if (!element || typeof element !== 'object') return false
    // Vue 3 tags its vnodes; Vue 2 vnodes are recognised by their shape
    return Boolean(element.__v_isVNode) ||
        ('componentOptions' in element && 'context' in element && element.tag !== undefined)
}

/*
 * `tooltip` and `addonAfter` reach FormItem as component *options objects*
 * carrying an extra `f` factory that the component reads back through
 * `$options.f()`, so they are handed to `h` whole rather than spread.
 */
export const resolveComponent = function(child, props) {
    if (!child) return null
    if (typeof child === 'string' || typeof child === 'number') return child
    if (typeof child === 'function') return child(props)
    if (isVnode(child)) return child
    return h(toRaw(child), {props}, {})
}
