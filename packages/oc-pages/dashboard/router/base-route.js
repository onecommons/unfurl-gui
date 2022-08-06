export function baseRoute(location) {
    const CANONICAL_PREFIX = '/-/unfurl';
    const SHORT_PREFIX = '/dashboard';
    let pathComponents;

    pathComponents = location.split(CANONICAL_PREFIX);
    if (pathComponents.length > 1) { return pathComponents[0] + CANONICAL_PREFIX + '/'; }
    pathComponents = location.split(SHORT_PREFIX);
    if (pathComponents.length > 1) { return pathComponents[0] + SHORT_PREFIX + '/'; }

    return null;
}

export function baseRouteNaive(location) {
    return baseRoute(location) || location.split('/').slice(0, 3).join('/')
}
