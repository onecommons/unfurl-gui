/*
 * Locating the fork's header, across GitLab versions.
 *
 * Two components position themselves relative to it. Both used to query
 * `[data-qa-selector="navbar"]` and call getBoundingClientRect() on the result
 * directly -- GitLab 19 dropped data-qa-selector attributes entirely, so the
 * query returned null and the throw took the whole component's data() with it.
 * In ufgui-errors that left $data empty, which rendered an alert with no
 * pagination bounds and therefore no text: a blank red box on every view.
 *
 * Hence: try each known selector, and degrade to a zero rect rather than
 * throwing. A component that cannot find the header should sit at the top of
 * the page, not disappear.
 */

const HEADER_SELECTORS = [
    '[data-qa-selector="navbar"]', // 15.11, and the standalone fixture shells
    'header.js-super-topbar',      // 19.x
    '.super-topbar',
]

const EMPTY_RECT = {x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0}

export function headerBounds() {
    for(const selector of HEADER_SELECTORS) {
        const element = document.querySelector(selector)
        if(element) return element.getBoundingClientRect()
    }
    return EMPTY_RECT
}

/*
 * Where the settings indicator's RIGHT edge should sit -- the button carries
 * translateX(-100%), so the value is its right edge, not its left.
 *
 * 15.11 nests a content box in .navbar-collapse that starts right of the logo,
 * so anchoring to its left edge tucked the gear beside the nav. 19.x has no
 * such element: falling back to the header rect gave x = 0, which put the
 * button's right edge at the viewport edge and the button off-screen. Hang it
 * off the header's right edge there instead.
 */
const INDICATOR_MARGIN = 8

export function settingsIndicatorAnchor() {
    const inner = document.querySelector('[data-qa-selector="navbar"] .navbar-collapse.collapse')
    if(inner) {
        const {x, y} = inner.getBoundingClientRect()
        return {x, y}
    }
    const header = headerBounds()
    return {x: header.right - INDICATOR_MARGIN, y: header.bottom}
}
