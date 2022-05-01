const GOOGLE_APPLICATION_CREDENTIALS = Cypress.env('GOOGLE_APPLICATION_CREDENTIALS')
const BASE_URL = Cypress.env('OC_URL')
const GCP_ZONE = Cypress.env('GCP_ZONE') || 'us-central1-a'

function createGCPEnvironment({environmentName}) {
  cy.visit(`${BASE_URL}/dashboard/environments`)
  cy.clickCreateEnvironmentButton()
  cy.completeEnvironmentDialog({environmentName, provider: 'gcp'})
  cy.url().should('not.include', '/dashboard/environments')
  authenticateGCP()
}

function authenticateGCP() {
  cy.contains('button', 'GOOGLE_APPLICATION_CREDENTIALS', {timeout: 10000}).click()
  cy.get('input[type="file"]').attachFile({
    encoding: 'utf-8',
    filePath: GOOGLE_APPLICATION_CREDENTIALS,
    lastModified: new Date().getTime(),
    force: true
  })
  cy.get('input[placeholder="us-central1-a"]').type(GCP_ZONE)
  cy.contains('button', 'Save').click()
  cy.url({timeout: 10000}).should('not.include', '/dashboard/-/clusters')
}

Cypress.Commands.add('createGCPEnvironment', createGCPEnvironment)
Cypress.Commands.add('authenticateGCP', authenticateGCP)


