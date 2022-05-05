const BASE_URL = Cypress.env('OC_URL')
const ENVIRONMENT_NAME = 'env-test-' + Cypress.env('GCP_ENVIRONMENT_NAME')
const GOOGLE_APPLICATION_CREDENTIALS = Cypress.env('GOOGLE_APPLICATION_CREDENTIALS')
const GCP_ZONE = Cypress.env('GCP_ZONE') || 'us-central1-a'
const REPOS_NAMESPACE = Cypress.env('REPOS_NAMESPACE')
const SIMPLE_BLUEPRINT = Cypress.env('SIMPLE_BLUEPRINT')

const createEnvironmentButton = () => cy.contains('button', 'Create New Environment', {timeout: 10000, matchCase: false})


describe('GCP environments', () => {
  beforeEach(() => {
    cy.whenEnvironmentExists(ENVIRONMENT_NAME, () => {
      cy.deleteEnvironment(ENVIRONMENT_NAME)
    })
    cy.environmentShouldNotExist(ENVIRONMENT_NAME)
  })

  afterEach(() => {
    cy.visit(`${BASE_URL}/dashboard/environments`)
    cy.environmentShouldExist(ENVIRONMENT_NAME)
  })

  it('Can create a gcp environment', () => {
    cy.createGCPEnvironment({environmentName: ENVIRONMENT_NAME})
  })

  it('Can create a gcp env from the overview page', () => {
    cy.visit(`${BASE_URL}/${REPOS_NAMESPACE}/${SIMPLE_BLUEPRINT}`)

    cy.contains('.oc_table_row', 'Google Cloud Platform') // TODO replace table row with testid
      .within(() => {
        cy.contains('button', 'Deploy').click()
      })

    cy.get('.dropdown-toggle.btn-default').click() // TODO use a testid
    createEnvironmentButton().click()

    cy.completeEnvironmentDialog({environmentName: ENVIRONMENT_NAME})
    cy.authenticateGCP()

    cy.contains('button', ENVIRONMENT_NAME, {timeout: 10000}).should('be.visible')
  })
})
