// ***********************************************************
// This example support/index.js is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// Import commands.js using ES2015 syntax:
import './commands'

const USERNAME = Cypress.env('OC_USERNAME')
const PASSWORD = Cypress.env('OC_PASSWORD')
const IMPERSONATE = Cypress.env('OC_IMPERSONATE')
const MOCK_DEPLOY = Cypress.env('UNFURL_MOCK_DEPLOY') || Cypress.env('MOCK_DEPLOY')
const DEPLOY_IMAGE = Cypress.env('DEPLOY_IMAGE')
const DEPLOY_TAG = Cypress.env('DEPLOY_TAG') // no longer in use
const DEFAULT_NAMESPACE = Cypress.env('DEFAULT_NAMESPACE')
const INTEGRATION_TEST_ARGS = Cypress.env('INTEGRATION_TEST_ARGS') 

const UNFURL_SERVER_URL = Cypress.env('UNFURL_SERVER_URL')

const UNFURL_VALIDATION_MODE = Cypress.env('UNFURL_VALIDATION_MODE') || Cypress.env('VALIDATION_MODE')

Cypress.Cookies.defaults({
  preserve: /.*/
})

const origLog = Cypress.log

// don't waste memory logging XHR requests
Cypress.log = function (opts, ...other) {
  if ( ['fetch', 'xhr', 'wrap'].includes( opts.displayName )) {
    return
  } 
  try {
    if ( opts.message?.includes("TypeError: ") ) {
      console.warn(opts.message)
      return
    }
  } catch(e) {console.error(opts)}
  return origLog(opts, ...other)
}

before(() => {
  Cypress.on('window:before:load', win => {
    console.log(win.gc)
    typeof win.gc == 'function' && win.gc()
  })

  Cypress.on('uncaught:exception', (err, runnable) => {
    return false
  })
  if(Cypress.spec.name.startsWith('00_visitor')) return
  cy.visit(`/users/sign_in`).wait(100)
  cy.url().then(url => {
    if(USERNAME && PASSWORD && url.endsWith('sign_in'))  {
      cy.getInputOrTextarea(`[data-qa-selector="login_field"]`).type(USERNAME)
      cy.getInputOrTextarea(`[data-qa-selector="password_field"]`).type(PASSWORD)
      cy.getInputOrTextarea(`[data-qa-selector="sign_in_button"]`).click()

      if(IMPERSONATE) {
        cy.visit(`/admin/users/${IMPERSONATE}`)
        cy.get('[data-qa-selector="impersonate_user_link"]').click()
        cy.url().should('not.contain', 'admin')

        if(INTEGRATION_TEST_ARGS.dashboardRepo) {
          cy.visit(`/${IMPERSONATE}/dashboard`)
        }
      }
    }
  })
})

beforeEach(() => {
  cy.window().then(win => {
    if(DEPLOY_IMAGE) {
      win.sessionStorage['deploy-image'] = DEPLOY_IMAGE
    }
    if(DEPLOY_TAG) {
      win.sessionStorage['deploy-tag'] = DEPLOY_TAG
    }
    if(MOCK_DEPLOY) {
      win.sessionStorage['mock-deploy'] = 't'
    }
    if(DEFAULT_NAMESPACE) {
      win.sessionStorage['defaultNamespace'] = DEFAULT_NAMESPACE
    }
    if(UNFURL_VALIDATION_MODE) {
      win.sessionStorage['unfurl-validation-mode'] = UNFURL_VALIDATION_MODE
    }
    if(UNFURL_SERVER_URL) {
      win.sessionStorage['unfurl-server-url'] = UNFURL_SERVER_URL
    }
    win.sessionStorage['unfurl-trace'] = 't'
  })

})
