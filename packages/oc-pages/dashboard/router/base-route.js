export function baseRoute(location) {
    try {
        return location.split('/-/')[0].replace(/\/$/, '')
    } catch(e) {
        return null
    }
}

export function baseRouteNaive(location) {
    return baseRoute(location) || location.split('/').slice(0, 3).join('/')
}
