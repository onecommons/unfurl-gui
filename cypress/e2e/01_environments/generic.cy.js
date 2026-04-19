const DASHBOARD_DEST = Cypress.env('DASHBOARD_DEST')
const ENVIRONMENT_NAME = 'env-test-' + 'generic'

describe('Generic environment', () => {
  beforeEach(() => {
    cy.whenEnvironmentExists(ENVIRONMENT_NAME, () => {
      cy.deleteEnvironment(ENVIRONMENT_NAME)
    })
    cy.environmentShouldNotExist(ENVIRONMENT_NAME)
  })

  afterEach(() => {
    cy.contains('Generic', {matchCase: false}).should('exist')
    cy.visit(`${DASHBOARD_DEST}/-/environments`)
    cy.environmentShouldExist(ENVIRONMENT_NAME)
  })

  it('Can create a generic environment', () => {
    cy.createGenericEnvironment({
      environmentName: ENVIRONMENT_NAME,
      shouldCreateExternalResource: true,
    })
  })

})
