/*
 * Two ways to authenticate, chosen by OC_FORM_AUTH.
 *
 * By endpoint (default): POST the sign-in form's target rather than typing into
 * it. GitLab 19 renders sign-in as a Vue app (#js-sign-in-form) and dropped
 * data-qa-selector product-wide, so the hooks the form flow types into are gone
 * there. The Rails form behind that app still carries authenticity_token and
 * the user[...] field names -- its hidden fields exist precisely so the names
 * cannot drift -- so posting outlives the next redesign. cy.request shares the
 * browser's cookie jar, so a later cy.visit is signed in.
 *
 * By form (OC_FORM_AUTH=1): drive the sign-in UI as a user would. Broken on
 * 19.3, but it is the only method that exercises the login page itself, so keep
 * it for testing that page and for instances old enough to have those hooks.
 *
 * followRedirect is off on every POST: what matters is that the action itself
 * succeeded, not where GitLab sends you next. Following the chain made
 * impersonation look broken -- the POST returned 302, then / redirected an
 * external user to /projects/new, which 403s because external users cannot
 * create projects, and cypress reported that as the request's status.
 *
 * This lives in its own module because the sign-in sequence was previously
 * written twice -- once here as cy.login, once inline in e2e.js's global before
 * hook -- and only the inline copy ran.
 */

// set to drive the sign-in form instead of posting to its endpoint
const FORM_AUTH = Cypress.env('OC_FORM_AUTH')

const CSRF_META = /name="csrf-token"[^>]*content="([^"]+)"/
const CSRF_FIELD = /name="authenticity_token"[^>]*value="([^"]+)"/

// the meta tag is on every page; the form field only on sign-in
export function withCsrf(path, fn) {
  cy.request(path).then(({body}) => {
    const token = (CSRF_META.exec(body) || CSRF_FIELD.exec(body) || [])[1]
    expect(token, `csrf token from ${path}`).to.be.a('string')
    fn(token)
  })
}

function signInByEndpoint(username, password) {
  withCsrf('/users/sign_in', authenticity_token => {
    cy.request({
      method: 'POST',
      url: '/users/sign_in',
      form: true,
      followRedirect: false,
      body: {
        authenticity_token,
        'user[login]': username,
        'user[password]': password,
        'user[remember_me]': '0',
      },
    })
  })
}

// admin/users/:id/impersonate, POST (config/routes/instance_admin.rb)
function impersonateByEndpoint(userId) {
  withCsrf(`/admin/users/${userId}`, authenticity_token => {
    cy.request({
      method: 'POST',
      url: `/admin/users/${userId}/impersonate`,
      form: true,
      followRedirect: false,
      body: {authenticity_token},
    })
  })
}

function signOutByEndpoint() {
  // stop impersonating first -- signing out of an impersonated session only
  // returns you to the admin. Rails rotates the token on session change, so
  // each request takes a fresh one.
  withCsrf('/', authenticity_token => {
    cy.request({
      method: 'DELETE',
      url: '/admin/impersonation',
      form: true,
      body: {authenticity_token},
      followRedirect: false,
      failOnStatusCode: false,
    })
  })
  withCsrf('/', authenticity_token => {
    cy.request({
      method: 'POST',
      url: '/users/sign_out',
      form: true,
      followRedirect: false,
      body: {authenticity_token},
    })
  })
}


/*
 * The form flow, kept verbatim from before the endpoint version existed. Its
 * data-qa-selector hooks are gone in GitLab 19, which is the whole reason for
 * the default above -- but on an instance that still has them this is the only
 * path that proves the login page works.
 */
function signInByForm(username, password) {
  cy.visit(`/users/sign_in`).wait(100)
  cy.url().then(url => {
    if(url.endsWith('sign_in')) {
      cy.getInputOrTextarea(`[data-qa-selector="login_field"]`).type(username)
      cy.getInputOrTextarea(`[data-qa-selector="password_field"]`).type(password)
      cy.getInputOrTextarea(`[data-qa-selector="sign_in_button"]`).click()
    }
  })
}

function impersonateByForm(userId) {
  cy.visit(`/admin/users/${userId}`)
  cy.get('[data-qa-selector="impersonate_user_link"]').click()
  cy.url().should('not.contain', 'admin')
}

function signOutByForm() {
  cy.get('[data-qa-selector="stop_impersonation_link"]').click()
  cy.get('[data-qa-selector="user_menu"]').click()
  cy.get('[data-qa-selector="sign_out_link"]').click()
  cy.url().should('include', 'sign_')
}

export function signIn(username, password) {
  return FORM_AUTH? signInByForm(username, password): signInByEndpoint(username, password)
}

export function impersonateUser(userId) {
  return FORM_AUTH? impersonateByForm(userId): impersonateByEndpoint(userId)
}

export function signOut() {
  return FORM_AUTH? signOutByForm(): signOutByEndpoint()
}
