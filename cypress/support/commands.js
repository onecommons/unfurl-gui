// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add('login', (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add('drag', { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add('dismiss', { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite('visit', (originalFn, url, options) => { ... })
//
//

import './undeploy' // should be imported before run-recreate-deployment
import './run-recreate-deployment'
import './create-aws-environment'
import './create-gcp-environment'
import './create-digitalocean-environment'
import './create-kubernetes-environment'
import './create-generic-environment'
import './environments'
import './github'
import './ci-jobs'
import 'cypress-wait-until'
import 'cypress-file-upload'

const BASE_TIMEOUT = Cypress.env('BASE_TIMEOUT')
const USERNAME = Cypress.env('OC_USERNAME')
const PASSWORD = Cypress.env('OC_PASSWORD')
const DEPLOY_IMAGE = Cypress.env('DEPLOY_IMAGE')
const MOCK_DEPLOY = Cypress.env('UNFURL_MOCK_DEPLOY') || Cypress.env('MOCK_DEPLOY')
const INTEGRATION_TEST_ARGS = Cypress.env('INTEGRATION_TEST_ARGS') 
const UNFURL_SERVER_URL = Cypress.env('UNFURL_SERVER_URL')
const UNFURL_VALIDATION_MODE = Cypress.env('UNFURL_VALIDATION_MODE') || Cypress.env('VALIDATION_MODE')

function whenUnfurlGUI(cb) {
  cy.window().then(win => {
    if(win.gon.unfurl_gui) {
      cb()
    }
  })
}

function whenGitlab(cb) {
  cy.window().then(win => {
    if(!win.gon.unfurl_gui) {
      cb()
    }
  })
}

function withStore(cb) {
  cy.waitUntil(() => cy.window().then(win => {
    if(win.$store.getters.environmentsAreReady) {
      cb && cb(win.$store)
      return win.$store
    }
    else {return false}
  }), {timeout: BASE_TIMEOUT * 2,  interval: 500})
}

function getInputOrTextarea(selector) {
  return cy.get(`input${selector}, textarea${selector}, ${selector} input`)
}

function execLoud(...args) {
  return cy.exec(...args).then(async result => {
    console.log(result)
    cy.task('log', `[${args[0]}][stdout]\n${result.stdout}`)
    cy.task('error', `[${args[0]}][stderr]\n${result.stderr}`)
    return cy.wrap(result)
  })
}

/*
 * Cypress 12.x
function login(impersonateUser) {
  cy.session(impersonateUser || USERNAME, () => {
    cy.visit(`/users/sign_in`).wait(100)
    cy.url().then(url => {
      if(USERNAME && PASSWORD && url.endsWith('sign_in'))  {
        cy.getInputOrTextarea(`[data-qa-selector="login_field"]`).type(USERNAME)
        cy.getInputOrTextarea(`[data-qa-selector="password_field"]`).type(PASSWORD)
        cy.getInputOrTextarea(`[data-qa-selector="sign_in_button"]`).click()

        if(impersonateUser) {
          cy.visit(`/admin/users/${impersonateUser}`)
          cy.get('[data-qa-selector="impersonate_user_link"]').click()
          cy.url().should('not.contain', 'admin')

        }
      }
    })
    cy.window().then(win => {
      if(DEPLOY_IMAGE) {
        win.sessionStorage['deploy-image'] = DEPLOY_IMAGE
      }
      if(MOCK_DEPLOY) {
        win.sessionStorage['mock-deploy'] = 't'
      }
      if(UNFURL_VALIDATION_MODE) {
        win.sessionStorage['unfurl-validation-mode'] = UNFURL_VALIDATION_MODE
      }
      if(UNFURL_SERVER_URL) {
        win.sessionStorage['unfurl-server-url'] = UNFURL_SERVER_URL
      }
      win.sessionStorage['unfurl-trace'] = 't'
    })
    cy.visit(`/${impersonateUser || USERNAME}/dashboard`)
  }, 
  {
    cacheAcrossSpecs: false,
    validate() {
      cy.visit('/')
      cy.url().should('not.contain', 'login')
    }
  })

}
*/

Cypress.Commands.add('whenGitlab', whenGitlab)
Cypress.Commands.add('whenUnfurlGUI', whenUnfurlGUI)
Cypress.Commands.add('withStore', withStore)
Cypress.Commands.add('getInputOrTextarea', getInputOrTextarea)
Cypress.Commands.add('execLoud', execLoud)
//Cypress.Commands.add('login', login)
