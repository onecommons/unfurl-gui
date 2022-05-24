const GOOGLE_APPLICATION_CREDENTIALS = Cypress.env('GOOGLE_APPLICATION_CREDENTIALS')
const BASE_URL = Cypress.env('OC_URL')
const GCP_ZONE = Cypress.env('GCP_ZONE') || 'us-central1-a'
const BASE_TIMEOUT = Cypress.env('BASE_TIMEOUT')

function createGCPEnvironment({environmentName, shouldCreateExternalResource}) {
  cy.visit(`${BASE_URL}/dashboard/environments`)
  cy.clickCreateEnvironmentButton()
  cy.completeEnvironmentDialog({environmentName, provider: 'gcp'})
  cy.url().should('not.include', '/dashboard/environments')
  authenticateGCP()

  validateGCPEnvironment()

  // create external resource
  if (shouldCreateExternalResource) {
    cy.createDigitalOceanDNSInstance(environmentName);
  }
}

function validateGCPEnvironment(filePath=GOOGLE_APPLICATION_CREDENTIALS) {
  cy.fixture(GOOGLE_APPLICATION_CREDENTIALS).then(credentials => {
    const {project_id} = credentials
    cy.contains(project_id, {timeout: BASE_TIMEOUT * 2.4}).should('be.visible')
    cy.contains(GCP_ZONE).should('be.visible')
    cy.contains('Local Development', {matchCase: false}).should('not.exist')
  })
}

function authenticateGCP(filePath=GOOGLE_APPLICATION_CREDENTIALS, click=true) {
  cy.contains('button', 'GOOGLE_APPLICATION_CREDENTIALS', {timeout: BASE_TIMEOUT * 2}).click()
  cy.get('input[type="file"]').attachFile({
    encoding: 'utf-8',
    filePath,
    lastModified: new Date().getTime(),
    force: true
  })
  cy.get('input[placeholder="us-central1-a"]').clear().type(GCP_ZONE)
  if(click) {
    cy.contains('button', 'Save').click()
    cy.url({timeout: BASE_TIMEOUT * 2}).should('not.include', '/dashboard/-/clusters')
  }
}

Cypress.Commands.add('createGCPEnvironment', createGCPEnvironment)
Cypress.Commands.add('validateGCPEnvironment', validateGCPEnvironment)
Cypress.Commands.add('authenticateGCP', authenticateGCP)


