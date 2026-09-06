const DASHBOARD_DEST = Cypress.env('DASHBOARD_DEST')

/*
 * Standalone (`unfurl serve --gui`) serves the dashboard at the root, and
 * DASHBOARD_DEST there is a filesystem path for the server — e.g.
 * "local:/tmp/unfurl-debug/ufsv" — not a URL segment. The GitLab fork mounts
 * the dashboard under its project path, where DASHBOARD_DEST *is* the path.
 *
 * Visiting `/${DASHBOARD_DEST}/-/environments` therefore 404s standalone.
 */
export const STANDALONE_DASHBOARD =
  !DASHBOARD_DEST || DASHBOARD_DEST.startsWith('/') || DASHBOARD_DEST.includes(':')

export const DASHBOARD_BASE = STANDALONE_DASHBOARD ? '' : `/${DASHBOARD_DEST}`

export function dashboardPath(suffix = '') {
  return `${DASHBOARD_BASE}${suffix}` || '/'
}
