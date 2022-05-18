const GOOGLE_APPLICATION_CREDENTIALS = Cypress.env('GOOGLE_APPLICATION_CREDENTIALS')
const BASE_URL = Cypress.env('OC_URL')
const GCP_ZONE = Cypress.env('GCP_ZONE') || 'us-central1-a'

function createGCPEnvironment({environmentName, shouldCreateExternalResource}) {
  cy.visit(`${BASE_URL}/dashboard/environments`)
  cy.clickCreateEnvironmentButton()
  cy.completeEnvironmentDialog({environmentName, provider: 'gcp'})
  cy.url().should('not.include', '/dashboard/environments')
  authenticateGCP()

  cy.fixture(GOOGLE_APPLICATION_CREDENTIALS).then(credentials => {
    const {project_id} = credentials
    cy.contains(project_id, {timeout: 12000}).should('be.visible')
    cy.contains(GCP_ZONE).should('be.visible')
  })

  // create external resource
  if (shouldCreateExternalResource) {
    cy.createDigitalOceanDNSInstance(environmentName);
  }
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


