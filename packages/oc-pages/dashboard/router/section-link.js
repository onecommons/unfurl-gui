/*
 * The fork's super sidebar takes its active item from the server -- computed
 * per request in lib/sidebars/menu.rb and baked into the payload -- and offers
 * no way to update it from the client. An SPA transition that crosses sections
 * therefore leaves the wrong item highlighted, so cross-section links navigate
 * for real there and the server gets asked again. Every section has a route
 * that answers any depth beneath it, so a resolved href always lands.
 *
 * Only crossings need this. Index and detail share a sidebar item, so browsing
 * inside a section stays an SPA transition. Standalone has no sidebar at all
 * and keeps the transition everywhere.
 */
export function sectionLinkProps(router, to) {
    if (window.gon.unfurl_gui) return {to}
    return {href: router.resolve(to).href}
}

export function sectionLinkHref(router, to) {
    return window.gon.unfurl_gui ? to : router.resolve(to).href
}
