/*
 * Port of @formily/element's FormLayout, including the responsive breakpoint
 * behaviour oc_inputs.vue relies on (`:breakpoints="[680]"` picks the vertical
 * layout for the narrow form and the horizontal one for a wide container).
 */
import { h } from '@formily/vue'
import { isArr, isValid } from '@formily/shared'
import {getCurrentInstance, inject, onBeforeUnmount, onMounted, provide, ref, watch} from 'vue-demi'
import {defineAdapter, stylePrefix} from './shared'

export const FormLayoutDeepContext = Symbol('FormLayoutDeepContext')
export const FormLayoutShallowContext = Symbol('FormLayoutShallowContext')

export const useFormDeepLayout = () => inject(FormLayoutDeepContext, ref({}))
export const useFormShallowLayout = () => inject(FormLayoutShallowContext, ref({}))

export const useFormLayout = () => {
    const shallowLayout = useFormShallowLayout()
    const deepLayout = useFormDeepLayout()
    const formLayout = ref({...deepLayout.value, ...shallowLayout.value})
    watch([shallowLayout, deepLayout], () => {
        formLayout.value = {...deepLayout.value, ...shallowLayout.value}
    }, {deep: true})
    return formLayout
}

const calcBreakpointIndex = (breakpoints, width) => {
    for (let i = 0; i < breakpoints.length; i++) {
        if (width <= breakpoints[i]) return i
    }
}

const calcFactor = (value, breakpointIndex) => {
    if (!Array.isArray(value)) return value
    if (breakpointIndex === -1) return value[0]
    return value[breakpointIndex] ?? value[value.length - 1]
}

const factor = (value, breakpointIndex) => isValid(value) ? calcFactor(value, breakpointIndex) : value

const calculateProps = (target, props) => {
    const {breakpoints, layout, labelAlign, wrapperAlign, labelCol, wrapperCol, ...otherProps} = props
    const breakpointIndex = calcBreakpointIndex(breakpoints, target.clientWidth)
    return {
        layout: factor(layout, breakpointIndex),
        labelAlign: factor(labelAlign, breakpointIndex),
        wrapperAlign: factor(wrapperAlign, breakpointIndex),
        labelCol: factor(labelCol, breakpointIndex),
        wrapperCol: factor(wrapperCol, breakpointIndex),
        ...otherProps
    }
}

const useResponsiveFormLayout = (props, root) => {
    if (!isArr(props.breakpoints)) return ref(props)

    const layoutProps = ref(props)
    let resizeObserver
    onMounted(() => {
        const update = () => {
            if (root.value) layoutProps.value = calculateProps(root.value, props)
        }
        resizeObserver = new ResizeObserver(update)
        if (root.value) resizeObserver.observe(root.value)
        update()
    })
    onBeforeUnmount(() => resizeObserver?.disconnect())
    return layoutProps
}

export const FormLayout = defineAdapter({
    name: 'FFormLayout',
    props: {
        className: {},
        colon: {default: true},
        labelAlign: {},
        wrapperAlign: {},
        labelWrap: {default: false},
        labelWidth: {},
        wrapperWidth: {},
        wrapperWrap: {default: false},
        labelCol: {},
        wrapperCol: {},
        fullness: {default: false},
        size: {default: 'default'},
        layout: {default: 'horizontal'},
        direction: {default: 'ltr'},
        shallow: {default: true},
        feedbackLayout: {},
        tooltipLayout: {},
        bordered: {default: true},
        inset: {default: false},
        breakpoints: {},
        spaceGap: {},
        gridColumnGap: {},
        gridRowGap: {}
    },
    setup(customProps, {slots}) {
        // `$el` after mount rather than a template ref: a string ref is the only
        // kind Vue 2.7's setup() accepts, and a Ref the only kind Vue 3 does
        const instance = getCurrentInstance()
        const root = ref(null)
        onMounted(() => { root.value = instance?.proxy?.$el })

        const props = useResponsiveFormLayout(customProps, root)
        const deepLayout = useFormDeepLayout()
        // .value, not the ref: spreading a Vue 3 ref copies its own __v_isRef,
        // so ref() hands the copy straight back and .value is undefined
        const newDeepLayout = ref({...deepLayout.value})
        const shallowProps = ref({})

        watch([props, deepLayout], () => {
            shallowProps.value = props.value.shallow ? props.value : undefined
            if (!props.value.shallow) {
                Object.assign(newDeepLayout.value, props.value)
            } else {
                if (props.value.size) newDeepLayout.value.size = props.value.size
                if (props.value.colon) newDeepLayout.value.colon = props.value.colon
            }
        }, {deep: true, immediate: true})

        provide(FormLayoutDeepContext, newDeepLayout)
        provide(FormLayoutShallowContext, shallowProps)

        const formPrefixCls = `${stylePrefix}-form`

        return () => h('div', {
            class: {
                [`${formPrefixCls}-${props.value.layout}`]: true,
                [`${formPrefixCls}-rtl`]: props.value.direction === 'rtl',
                [`${formPrefixCls}-${props.value.size}`]: props.value.size !== undefined,
                [`${props.value.className}`]: props.value.className !== undefined
            }
        }, slots)
    }
})

export default FormLayout
