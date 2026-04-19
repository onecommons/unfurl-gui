const DASHBOARD_DEST = Cypress.env('DASHBOARD_DEST')
const ENVIRONMENT_NAME = 'env-test-' + Cypress.env('DO_ENVIRONMENT_NAME')

describe('Digital Ocean environments', () => {
  beforeEach(() => {
    cy.whenEnvironmentExists(ENVIRONMENT_NAME, () => {
      cy.deleteEnvironment(ENVIRONMENT_NAME)
    })
    cy.environmentShouldNotExist(ENVIRONMENT_NAME)
  })

  afterEach(() => {
    cy.contains('.properties-list-container', 'Generic', {matchCase: false}).should('not.exist')
    cy.visit(`${DASHBOARD_DEST}/-/environments`)
    cy.environmentShouldExist(ENVIRONMENT_NAME)
  })

  it('Can create a digital ocean environment', () => {
    cy.createDigitalOceanEnvironment({
      environmentName: ENVIRONMENT_NAME,
      shouldCreateExternalResource: true,
    })
  })

})
