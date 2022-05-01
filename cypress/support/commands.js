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

import './run-recreate-deployment'
import './create-aws-environment'
import './create-gcp-environment'
import './environments'
import 'cypress-wait-until'
import 'cypress-file-upload'

Cypress.Commands.add('waitForGraphql', () => {
  // https://stackoverflow.com/questions/59171600/allow-cy-wait-to-fail
  cy.on('fail', (err) => {
    if (err.name === 'CypressError' && err.message.includes('Timed out')) {
      return true;
    }
    throw err;
  });

  for(let i = 0; i < 2; i++) {
    cy.intercept({
      method: "POST",
      url: "**/graphql",
    }).as("dataGetFirst");
    cy.wait("@dataGetFirst")
    cy.wait(200)
  }
})


const operationName = "ClearProjectPath"
const query = "mutation ClearProjectPath($projectPath: ID!, $patch: JSON!, $path: String!) {\n  updateDeploymentObj(\n    input: {projectPath: $projectPath, patch: $patch, path: $path}\n  ) {\n    errors\n    __typename\n  }\n}\n"

Cypress.Commands.add('resetDataFromFixture', (projectPath, fixture) => {
  cy.on('uncaught:exception', (e) => false) // don't care if we error in here


  let _fixture = fixture || projectPath
  if(!_fixture.endsWith('.json')) _fixture = _fixture + '.json'
  const _projectPath = projectPath.replace(/\.json$/, '')
  cy.visit(Cypress.env('OC_URL'))

  cy.document().then(doc => {
    const csrfToken = doc.querySelector('meta[name="csrf-token"]')?.content

    cy.fixture(`blueprints/${_fixture}`).then((payload) => {
      const patch = []
      for(const __typename in payload) {
        const dictionary = payload[__typename] 
          for(const name in dictionary) {
            const entry = dictionary[name]
            patch.push({name, ...entry, __typename})
          }

      }
      try {
        cy.log(`resetting data for ${projectPath}`)
        const variables = {projectPath, patch, path: 'unfurl.json'}
        cy.request({
          method:'POST', 
          url: Cypress.env('OC_GRAPHQL_ENDPOINT'), 
          body: {
            variables, operationName, query, projectPath: _projectPath
          },
          headers: {
            'X-CSRF-Token': csrfToken,
            'Content-Type': 'application/json'
          }
        })
      } catch(e) {
        cy.log(`failed to reset data for ${projectPath}: ${e.message}`)
        throw e
      }
    })
    return 
  })
})
