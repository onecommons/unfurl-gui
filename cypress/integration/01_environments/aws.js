const BASE_URL = Cypress.env('OC_URL')
// const ENVIRONMENT_NAME = 'env-test-' + Cypress.env('AWS_ENVIRONMENT_NAME')
const ENVIRONMENT_NAME = 'env-test-aws-2022-05-11t19-30-55-239z'
const AWS_ACCESS_KEY = Cypress.env('AWS_ACCESS_KEY_ID')
const AWS_SECRET_ACCESS_KEY = Cypress.env('AWS_SECRET_ACCESS_KEY')
const REPOS_NAMESPACE = Cypress.env('REPOS_NAMESPACE')
const SIMPLE_BLUEPRINT = Cypress.env('SIMPLE_BLUEPRINT')

const createEnvironmentButton = () => cy.contains('button', 'Create New Environment', {timeout: 10000, matchCase: false})
const ENVIRONMENT_NAME_INPUT = '[data-testid="environment-name-input"]'
const CLOUD_PROVIDER_DROPDOWN = '[data-testid="cloud-provider-dropdown"]'
const ENV_OPTION_AWS = `[data-testid="env-option-aws"]`

function selectAuthenticationMethod() {
  cy.contains('button', 'Select').click()
  cy.contains('button', 'Enter your AWS Access Key').click()
}

function completeEnvironmentDialog(chooseCloudProvider=true) {
  cy.get(ENVIRONMENT_NAME_INPUT).type(ENVIRONMENT_NAME)
  if(chooseCloudProvider) {
    cy.get(CLOUD_PROVIDER_DROPDOWN).click()
    cy.get(ENV_OPTION_AWS).click()
  }
  cy.contains('button', 'Next').click()
}

function authenticateWithAccessKeys() {
  selectAuthenticationMethod()
  cy.contains('AWS Access key ID').next().type(AWS_ACCESS_KEY)

  cy.contains('AWS Secret access key').next().type(AWS_SECRET_ACCESS_KEY)
  cy.contains('button', 'Save').click()
  cy.url().should('not.include', '/dashboard/-/clusters')
}

describe('AWS environments', () => {

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

  it('Can create an aws environment', () => {
    cy.createAWSEnvironment({
      environmentName: ENVIRONMENT_NAME,
      shouldCreateExternalResource: true,
    })
  })

  it('Can create an aws env from the overview page', () => {
    cy.visit(`${BASE_URL}/${REPOS_NAMESPACE}/${SIMPLE_BLUEPRINT}`)

    // cy.contains('.oc_table_row', 'Amazon Web Services') // TODO replace table row with testid
    //   .within(() => {
    //     cy.contains('button', 'Deploy').click()
    //   })

    const TEMPLATE_NAME = 'aws' 
    cy.get(`[data-testid="template-${TEMPLATE_NAME}]"`)   // using constant now, this can be reused
      .within(() => {
        cy.contains('button', 'Deploy').click()
      })

    // cy.get('.dropdown-toggle.btn-default').click() // TODO use a testid
    cy.get('[data-testid="dropdown-default"]').click()
    createEnvironmentButton().click()

    completeEnvironmentDialog(false)
    authenticateWithAccessKeys()

    cy.contains('button', ENVIRONMENT_NAME, {timeout: 10000}).should('be.visible')

  })

})
