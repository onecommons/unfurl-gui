const BASE_URL = Cypress.env('OC_URL')
const ENVIRONMENT_NAME = 'env-test-' + Cypress.env('DO_ENVIRONMENT_NAME')

describe('Digital Ocean environments', () => {
  beforeEach(() => {
    cy.whenEnvironmentExists(ENVIRONMENT_NAME, () => {
      cy.deleteEnvironment(ENVIRONMENT_NAME)
    })
    cy.environmentShouldNotExist(ENVIRONMENT_NAME)
  })

  afterEach(() => {
    cy.visit(`${BASE_URL}/{USERNAME}/dashboard/-/environments`)
    cy.environmentShouldExist(ENVIRONMENT_NAME)
    cy.contains('Local Development', {matchCase: false}).should('not.exist')
  })

  it('Can create a digital ocean environment', () => {
    cy.createDigitalOceanEnvironment({
      environmentName: ENVIRONMENT_NAME,
      shouldCreateExternalResource: true,
    })
  })

})
