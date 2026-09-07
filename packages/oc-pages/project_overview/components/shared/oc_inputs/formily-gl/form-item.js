/*
 * Port of @formily/element's FormItem over @gitlab/ui.
 *
 * The label/control/feedback DOM and its class names are kept as upstream
 * emitted them, because oc_inputs.vue's scoped rules and the committed
 * screenshot baselines are written against them.
 *
 * Dropped from upstream: the ResizeObserver that turned an overflowing label
 * into a tooltip (labels here are `flex-basis: fit-content`, so they never
 * overflow), and the grid/col layout props, which nothing sets.
 */
import { isVoidField } from '@formily/core'
import { uid } from '@formily/shared'
import { connect, h, mapProps } from '@formily/vue'
import { GlIcon, GlPopover } from '@gitlab/ui'
import { defineComponent, provide, ref } from 'vue-demi'
import { FormLayoutShallowContext, useFormLayout } from './form-layout'
import { composeExport, resolveComponent, stylePrefix } from './shared'

const ICON_MAP = {
    error: 'error',
    success: 'check-circle',
    warning: 'warning'
}

/*
 * Descriptions are markdown. The app registers a text -> HTML renderer here
 * instead of re-querying the rendered DOM for
 * `.formily-element-form-item-extra`, which is what oc_inputs.vue's
 * form.onMount used to do -- and quietly skipped whenever the card's wrapper
 * was a plain element rather than a component.
 */
let extraRenderer = null
export const registerExtraRenderer = fn => { extraRenderer = fn }

export const FormBaseItem = defineComponent({
    name: 'FormItem',
    props: {
        className: {},
        required: {},
        label: {},
        colon: {},
        layout: {},
        tooltip: {},
        labelStyle: {},
        labelAlign: {},
        labelWrap: {},
        labelWidth: {},
        wrapperWidth: {},
        wrapperAlign: {},
        wrapperWrap: {},
        wrapperStyle: {},
        fullness: {},
        addonBefore: {},
        addonAfter: {},
        size: {},
        extra: {},
        feedbackText: {},
        feedbackLayout: {},
        tooltipLayout: {},
        feedbackStatus: {},
        feedbackIcon: {},
        asterisk: {},
        gridSpan: {},
        bordered: {default: true},
        inset: {default: false}
    },
    setup(props, {slots}) {
        const active = ref(false)
        const deepLayoutRef = useFormLayout()
        const prefixCls = `${stylePrefix}-form-item`
        // popovers are anchored by id: a template ref would need a different
        // shape on Vue 2.7 and Vue 3
        const anchorId = `fi-${uid()}`
        const tooltipId = `${anchorId}-tooltip`

        provide(FormLayoutShallowContext, ref(null))

        return () => {
            const deepLayout = deepLayoutRef.value
            const {
                label, tooltip, addonBefore, addonAfter, extra, feedbackText,
                feedbackStatus, feedbackIcon, asterisk
            } = props
            const colon = props.colon ?? deepLayout.colon ?? true
            const layout = props.layout ?? deepLayout.layout ?? 'horizontal'
            const labelStyle = props.labelStyle ?? {}
            const labelWrap = props.labelWrap ?? deepLayout.labelWrap ?? false
            const labelWidth = props.labelWidth ?? deepLayout.labelWidth
            const wrapperWidth = props.wrapperWidth ?? deepLayout.wrapperWidth
            const wrapperAlign = props.wrapperAlign ?? deepLayout.wrapperAlign ?? 'left'
            const wrapperWrap = props.wrapperWrap ?? deepLayout.wrapperWrap
            const wrapperStyle = props.wrapperStyle ?? {}
            const fullness = props.fullness ?? deepLayout.fullness
            const size = props.size ?? deepLayout.size
            const feedbackLayout = props.feedbackLayout ?? deepLayout.feedbackLayout ?? 'loose'
            const tooltipLayout = props.tooltipLayout ?? deepLayout.tooltipLayout ?? 'icon'
            const bordered = props.bordered ?? deepLayout.bordered
            const inset = props.inset ?? deepLayout.inset

            const labelAlign = deepLayout.layout === 'vertical'
                ? props.labelAlign ?? deepLayout.labelAlign ?? 'left'
                : props.labelAlign ?? deepLayout.labelAlign ?? 'right'

            if (labelWidth) {
                labelStyle.width = `${labelWidth}px`
                labelStyle.maxWidth = `${labelWidth}px`
            }
            if (wrapperWidth) {
                wrapperStyle.width = `${wrapperWidth}px`
                wrapperStyle.maxWidth = `${wrapperWidth}px`
            }

            const renderHelp = () => h('div', {
                class: {
                    [`${prefixCls}-${feedbackStatus}-help`]: !!feedbackStatus,
                    [`${prefixCls}-help`]: true
                }
            }, {
                default: () => [
                    feedbackStatus && ICON_MAP[feedbackStatus]
                        ? h(GlIcon, {props: {name: ICON_MAP[feedbackStatus], size: 12}}, {})
                        : '',
                    resolveComponent(feedbackText)
                ]
            })

            // upstream wrapped the widget in an el-popover; gl-popover is
            // anchored at a target instead, so the widget keeps its own wrapper
            const formatChildren = feedbackLayout === 'popover'
                ? [
                    h('div', {attrs: {id: anchorId}}, {default: () => slots.default?.()}),
                    feedbackText && h(GlPopover, {
                        attrs: {target: anchorId, triggers: 'hover focus', placement: 'top'}
                    }, {default: () => [renderHelp()]})
                ]
                : slots.default?.()

            const renderLabelText = () => h('div', {class: `${prefixCls}-label-content`}, {
                default: () => [
                    asterisk && h('span', {class: `${prefixCls}-asterisk`}, {default: () => ['*']}),
                    h('label', {}, {default: () => [resolveComponent(label)]})
                ]
            })

            const renderTooltipIcon = () => {
                if (!tooltip || tooltipLayout !== 'icon') return null
                return h('span', {class: `${prefixCls}-label-tooltip`, attrs: {id: tooltipId}}, {
                    default: () => [
                        h(GlIcon, {props: {name: 'information-o', size: 16}}, {}),
                        h(GlPopover, {
                            attrs: {target: tooltipId, triggers: 'hover focus', placement: 'top'}
                        }, {
                            default: () => [
                                h('div', {class: `${prefixCls}-label-tooltip-content`}, {
                                    default: () => [resolveComponent(tooltip)]
                                })
                            ]
                        })
                    ]
                })
            }

            const renderLabel = label && h('div', {
                class: {
                    [`${prefixCls}-label`]: true,
                    [`${prefixCls}-label-tooltip`]: tooltip && tooltipLayout === 'text'
                },
                style: labelStyle
            }, {
                default: () => [
                    renderLabelText(),
                    renderTooltipIcon(),
                    h('span', {class: `${prefixCls}-colon`}, {default: () => [colon ? ':' : '']})
                ]
            })

            const renderFeedback = !!feedbackText &&
                feedbackLayout !== 'popover' &&
                feedbackLayout !== 'none' &&
                h('div', {
                    class: {
                        [`${prefixCls}-${feedbackStatus}-help`]: !!feedbackStatus,
                        [`${prefixCls}-help`]: true,
                        [`${prefixCls}-help-enter`]: true,
                        [`${prefixCls}-help-enter-active`]: true
                    }
                }, {default: () => [resolveComponent(feedbackText)]})

            const extraHtml = extraRenderer && typeof extra === 'string'
                ? extraRenderer(extra)
                : null
            const renderExtra = extra && (extraHtml != null
                ? h('div', {class: `${prefixCls}-extra`, domProps: {innerHTML: extraHtml}}, {})
                : h('div', {class: `${prefixCls}-extra`}, {
                    default: () => [resolveComponent(extra)]
                }))

            const renderContent = h('div', {class: `${prefixCls}-control`}, {
                default: () => [
                    h('div', {class: `${prefixCls}-control-content`}, {
                        default: () => [
                            addonBefore && h('div', {class: `${prefixCls}-addon-before`}, {
                                default: () => [resolveComponent(addonBefore)]
                            }),
                            h('div', {
                                class: {
                                    [`${prefixCls}-control-content-component`]: true,
                                    [`${prefixCls}-control-content-component-has-feedback-icon`]: !!feedbackIcon
                                },
                                style: wrapperStyle
                            }, {
                                default: () => [
                                    formatChildren,
                                    feedbackIcon && h('div', {class: `${prefixCls}-feedback-icon`}, {
                                        default: () => [resolveComponent(feedbackIcon)]
                                    })
                                ]
                            }),
                            addonAfter && h('div', {class: `${prefixCls}-addon-after`}, {
                                default: () => [resolveComponent(addonAfter)]
                            })
                        ]
                    }),
                    renderFeedback,
                    renderExtra
                ]
            })

            return h('div', {
                attrs: {'data-grid-span': props.gridSpan},
                class: {
                    [prefixCls]: true,
                    [`${prefixCls}-layout-${layout}`]: true,
                    [`${prefixCls}-${feedbackStatus}`]: !!feedbackStatus,
                    [`${prefixCls}-feedback-has-text`]: !!feedbackText,
                    [`${prefixCls}-size-${size}`]: !!size,
                    [`${prefixCls}-feedback-layout-${feedbackLayout}`]: !!feedbackLayout,
                    [`${prefixCls}-fullness`]: !!fullness || !!inset || !!feedbackIcon,
                    [`${prefixCls}-inset`]: !!inset,
                    [`${prefixCls}-active`]: active.value,
                    [`${prefixCls}-inset-active`]: !!inset && active.value,
                    [`${prefixCls}-label-align-${labelAlign}`]: true,
                    [`${prefixCls}-control-align-${wrapperAlign}`]: true,
                    [`${prefixCls}-label-wrap`]: !!labelWrap,
                    [`${prefixCls}-control-wrap`]: !!wrapperWrap,
                    [`${prefixCls}-bordered-none`]: bordered === false || !!inset || !!feedbackIcon,
                    [`${props.className}`]: !!props.className
                },
                on: {
                    focus: () => { if (feedbackIcon || inset) active.value = true },
                    blur: () => { if (feedbackIcon || inset) active.value = false }
                }
            }, {default: () => [renderLabel, renderContent]})
        }
    }
})

const Item = connect(
    FormBaseItem,
    mapProps({validateStatus: true, title: 'label', required: true}, (props, field) => {
        if (isVoidField(field) || !field) return props
        const takeMessage = () => {
            if (field.validating) return
            if (props.feedbackText) return props.feedbackText
            if (field.selfErrors.length) return field.selfErrors
            if (field.selfWarnings.length) return field.selfWarnings
            if (field.selfSuccesses.length) return field.selfSuccesses
        }
        const errorMessages = takeMessage()
        return {
            feedbackText: Array.isArray(errorMessages) ? errorMessages.join(', ') : errorMessages,
            extra: props.extra || field.description
        }
    }, (props, field) => {
        if (isVoidField(field) || !field) return props
        return {
            feedbackStatus: field.validateStatus === 'validating'
                ? 'pending'
                : (Array.isArray(field.decorator) && field.decorator[1]?.feedbackStatus) || field.validateStatus
        }
    }, (props, field) => {
        if (isVoidField(field) || !field) return props
        let asterisk = false
        if (field.required && field.pattern !== 'readPretty') asterisk = true
        if ('asterisk' in props) asterisk = props.asterisk
        return {asterisk}
    })
)

export const FormItem = composeExport(Item, {BaseItem: FormBaseItem})

export default FormItem
