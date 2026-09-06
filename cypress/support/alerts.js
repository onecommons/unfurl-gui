/*
 * Alerts render differently in the two environments, so specs must match both.
 *
 * The GitLab fork resolves `~/alert` to GitLab's own helper, which mounts a
 * GlAlert: `.gl-alert`, `.gl-alert-danger`, body text in `.gl-alert-body`.
 *
 * Standalone resolves it to the shim in `src/assets/javascripts/alert.js`,
 * which writes `.flash-<variant>` into `.flash-container` with body text in
 * `.flash-text`. Its variant classes are flash-alert (danger), flash-success,
 * flash-warning and flash-notice (info).
 *
 * A spec that matches only the gl-* shape does not fail standalone — it
 * silently never matches, which makes "should not exist" assertions
 * vacuously true.
 */
export const ALERT_BODY = '.gl-alert-body, .flash-container .flash-text'

export const DANGER_ALERT = '.gl-alert.gl-alert-danger, .flash-container .flash-alert'

export const SUCCESS_ALERT = '.gl-alert.gl-alert-success, .flash-container .flash-success'

/*
 * These are selector *lists*. cy.contains(selector, text) binds its :contains
 * filter ambiguously across a comma list and silently yields null, so assert
 * with cy.get(...).should('contain.text', ...) instead.
 */
