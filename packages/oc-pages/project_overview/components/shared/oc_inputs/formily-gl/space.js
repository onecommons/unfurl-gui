/*
 * Port of @formily/element's Space. Nothing here is Element-specific; the one
 * change is unwrapping @formily/vue's Fragment on either Vue version instead of
 * reaching into a Vue 2 vnode's `componentOptions`.
 */
import { h } from '@formily/vue'
import {isVue2} from 'vue-demi'
import {defineAdapter, stylePrefix} from './shared'
import { useFormLayout } from './form-layout'

const spaceSize = {small: 8, middle: 16, large: 24}

const isFragment = vnode => {
    const name = isVue2 ? vnode?.tag : vnode?.type?.name
    return typeof name === 'string' && name.endsWith('Fragment')
}

// RecursionField hands its properties over as one Fragment; each of them wants
// its own space item, so the wrapper has to be peeled off first.
const unwrapFragment = children => {
    if (!Array.isArray(children) || children.length !== 1) return children || []
    const only = children[0]
    if (!isFragment(only)) return children
    const inner = isVue2 ? only.componentOptions?.children : only.children?.default?.()
    return inner ?? children
}

export const Space = defineAdapter({
    name: 'FSpace',
    props: ['size', 'direction', 'align'],
    setup(props, {attrs, slots}) {
        const layout = useFormLayout()
        return () => {
            const {align} = props
            const size = props.size ?? layout.value?.spaceGap ?? 'small'
            const direction = props.direction ?? 'horizontal'
            const prefixCls = `${stylePrefix}-space`

            const items = unwrapFragment(slots.default?.())
            if (items.length === 0) return null

            const mergedAlign = align === undefined && direction === 'horizontal' ? 'center' : align
            const itemClassName = `${prefixCls}-item`

            return h('div', {
                ...attrs,
                class: {
                    ...attrs.class,
                    [prefixCls]: true,
                    [`${prefixCls}-${direction}`]: true,
                    [`${prefixCls}-align-${mergedAlign}`]: mergedAlign
                },
                style: {
                    ...attrs.style,
                    gap: typeof size === 'string' ? `${spaceSize[size]}px` : `${size}px`
                }
            }, {
                default: () => items.map((child, i) => h('div', {
                    class: itemClassName,
                    key: `${itemClassName}-${i}`
                }, {default: () => [child]}))
            })
        }
    }
})

export default Space
