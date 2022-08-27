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
import './environments'
import './github'
import './ci-jobs'
import './obsolete.js'
import 'cypress-wait-until'
import 'cypress-file-upload'

const BASE_TIMEOUT = Cypress.env('BASE_TIMEOUT')

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
  return cy.get(`input${selector}, textarea${selector}`)
}

Cypress.Commands.add('whenGitlab', whenGitlab)
Cypress.Commands.add('whenUnfurlGUI', whenUnfurlGUI)
Cypress.Commands.add('withStore', withStore)
Cypress.Commands.add('getInputOrTextarea', getInputOrTextarea)
