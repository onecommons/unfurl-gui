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

const BASE_URL = Cypress.env('OC_URL') || 'localhost:8080'
const USERNAME = Cypress.env('OC_USERNAME')
const PASSWORD = Cypress.env('OC_PASSWORD')
const IMPERSONATE = Cypress.env('OC_IMPERSONATE')
const MOCK_DEPLOY = Cypress.env('MOCK_DEPLOY') || Cypress.env('UNFURL_MOCK_DEPLOY')
const DEPLOY_IMAGE = Cypress.env('DEPLOY_IMAGE')
const DEPLOY_TAG = Cypress.env('DEPLOY_TAG')

Cypress.Cookies.defaults({
  preserve: /.*/
})

before(() => {
  Cypress.on('uncaught:exception', (err, runnable) => {
    return false
  })
  if(Cypress.spec.name.startsWith('00_visitor')) return
  cy.visit(`${BASE_URL}/users/sign_in`).wait(100)
  cy.url().then(url => {
    if(USERNAME && PASSWORD && url.endsWith('sign_in'))  {
      cy.get(`input[data-qa-selector="login_field"]`).type(USERNAME)
      cy.get(`input[data-qa-selector="password_field"]`).type(PASSWORD)
      cy.get(`input[data-qa-selector="sign_in_button"]`).click()

      if(IMPERSONATE) {
        cy.visit(`${BASE_URL}/admin/users/${IMPERSONATE}`)
        cy.get('[data-qa-selector="impersonate_user_link"]').click()
        cy.url().should('not.contain', 'admin')
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
    win.sessionStorage['unfurl-trace'] = 't'
  })

})
