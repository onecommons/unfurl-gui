/*
 * Records whether the last interaction came from a pointer or the keyboard, as
 * `data-input-modality` on <html>.
 *
 * :focus-visible cannot answer this for us. Components that manage their own
 * focus -- GlDisclosureDropdown when it opens, GlTabs when a tab is selected --
 * call .focus() themselves, and programmatic focus counts as focus-visible, so
 * the ring appears after a click on exactly the controls that move focus. The
 * modality has to be tracked from the input event instead.
 */
const KEYS = new Set(['Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Escape'])

let installed = false

export function trackInputModality(doc = document) {
    if (installed) return
    installed = true

    const set = modality => doc.documentElement.setAttribute('data-input-modality', modality)

    // capture: a component's own handler may move focus before these bubble
    doc.addEventListener('pointerdown', () => set('pointer'), true)
    doc.addEventListener('keydown', event => { if (KEYS.has(event.key)) set('keyboard') }, true)

    set('pointer')
}
