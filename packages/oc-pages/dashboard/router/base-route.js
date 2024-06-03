export function baseRoute(location) {
    try {
        return location.split('/-/')[0].replace(/\/$/, '')
    } catch(e) {
        return null
    }
}

export function baseRouteNaive(location) {
    let result = baseRoute(location) || location.split('/').slice(0, 3).join('/')

    if(result.startsWith('/-')) {
        result = '/'
    }

    return result
}
