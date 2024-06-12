const BASE_TIMEOUT = Cypress.env('BASE_TIMEOUT')
const ENVIRONMENT_NAME = 'env-test-' + Cypress.env('GCP_ENVIRONMENT_NAME')
const GOOGLE_APPLICATION_CREDENTIALS = Cypress.env('GOOGLE_APPLICATION_CREDENTIALS')
const GCP_ZONE = Cypress.env('GCP_ZONE') || 'us-central1-a'
const REPOS_NAMESPACE = Cypress.env('REPOS_NAMESPACE')
const SIMPLE_BLUEPRINT = Cypress.env('SIMPLE_BLUEPRINT')
const DASHBOARD_DEST = Cypress.env('DASHBOARD_DEST')

const createEnvironmentButton = () => cy.contains('button', 'Create New Environment', {timeout: BASE_TIMEOUT * 2, matchCase: false})

function authenticateWithInvalidJSON() {
  cy.url().should('not.include', `/${DASHBOARD_DEST}/-/environments`)
  cy.authenticateGCP('malformed-service-account-key.json.txt', false) // txt extension to keep cypress from parsing
  cy.get('.flash-alert').should('be.visible')
  cy.contains('invalid JSON').should('be.visible')
  cy.contains('button', 'Save').should('be.disabled')

}

describe('GCP environments', () => {
  beforeEach(() => {
    cy.whenEnvironmentExists(ENVIRONMENT_NAME, (env) => {
      cy.deleteEnvironment(ENVIRONMENT_NAME)
    })
    cy.environmentShouldNotExist(ENVIRONMENT_NAME)
  })

  afterEach(() => {
    cy.contains('.properties-list-container', 'Generic', {matchCase: false}).should('not.exist')
    cy.visit(`/${DASHBOARD_DEST}/-/environments`)
    cy.environmentShouldExist(ENVIRONMENT_NAME)
  })

  it('Can gracefully handle invalid JSON', () => {
    cy.visit(`/${DASHBOARD_DEST}/-/environments`)
    cy.clickCreateEnvironmentButton()
    cy.completeEnvironmentDialog({environmentName: ENVIRONMENT_NAME, provider: 'gcp'})
    authenticateWithInvalidJSON()

    cy.visit(`/${DASHBOARD_DEST}/-/environments`)
    cy.environmentShouldNotExist(ENVIRONMENT_NAME)

    cy.clickCreateEnvironmentButton()
    cy.completeEnvironmentDialog({environmentName: ENVIRONMENT_NAME, provider: 'gcp'})
    authenticateWithInvalidJSON()

    cy.authenticateGCP()
  })

  it('Can create a gcp environment', () => {
    cy.createGCPEnvironment({
      environmentName: ENVIRONMENT_NAME,
      shouldCreateExternalResource: true,
    })
  })

  it('Can create a gcp env from the overview page', () => {
    cy.visit(`/${REPOS_NAMESPACE}/${SIMPLE_BLUEPRINT}`)

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
