// Build the URL prefix for a "home project". Returns a path starting with
// `/` (e.g. `/myorg/mydashboard`) for normal Unfurl Cloud projects, and an
// empty string for standalone (`local:/...`) home paths.
//
// Standalone home paths can't be put in URLs literally:
//   * Vue Router's `mode: history` base detection picks up `local:`; path-to-
//     regexp reads the `:` as a parameter marker, the deployment / environment
//     routes fail to match, and you land on PageNotFound.
//   * The address bar shows `local:` which is confusing.
//   * Server routes have to special-case it.
// For the standalone case, returning `""` lets callers write
// `${projectPathToHomeRoute(path)}/-/...` and get a root-relative URL.
//
// IMPORTANT: callers should not prepend an additional `/` — interpolating
// `/${projectPathToHomeRoute(p)}/-/...` with an empty return yields `//-/...`,
// which the browser parses as a protocol-relative URL (host = `-`).
export function projectPathToHomeRoute(projectPath) {
    if (!projectPath || projectPath.startsWith('local:')) return ''
    return '/' + projectPath
}
