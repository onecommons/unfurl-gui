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
import './environments'
import './ci-jobs'
import './obsolete.js'
import 'cypress-wait-until'
import 'cypress-file-upload'

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
  cy.window().then(win => {
    console.log(win.$store)
    cb(win.$store)
  })
}

Cypress.Commands.add('whenGitlab', whenGitlab)
Cypress.Commands.add('whenUnfurlGUI', whenUnfurlGUI)
Cypress.Commands.add('withStore', withStore)
