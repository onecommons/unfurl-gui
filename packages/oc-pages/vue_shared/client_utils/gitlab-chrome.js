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
 * The header's inner content box, which is where the settings indicator wants
 * to sit. 15.11 nests it in .navbar-collapse; 19.x has no such element, so
 * fall back to the header itself.
 */
export function headerContentBounds() {
    const inner = document.querySelector('[data-qa-selector="navbar"] .navbar-collapse.collapse')
    return inner ? inner.getBoundingClientRect() : headerBounds()
}
