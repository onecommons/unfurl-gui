const BASE_URL = Cypress.env('OC_URL')
const ENVIRONMENT_NAME = Cypress.env('AWS_ENVIRONMENT_NAME')
const AWS_ACCESS_KEY = Cypress.env('AWS_ACCESS_KEY_ID')
const AWS_SECRET_ACCESS_KEY = Cypress.env('AWS_SECRET_ACCESS_KEY')
const REPOS_NAMESPACE = Cypress.env('REPOS_NAMESPACE')
const BASE_TIMEOUT = Cypress.env('BASE_TIMEOUT')

const createEnvironmentButton = () => cy.contains('button', 'Create New Environment', {timeout: BASE_TIMEOUT * 2})
const ENVIRONMENT_NAME_INPUT = '[data-testid="environment-name-input"]'
const CLOUD_PROVIDER_DROPDOWN = '[data-testid="cloud-provider-dropdown"]'
const ENV_OPTION_AWS = `[data-testid="env-option-aws"]`

Cypress.Commands.add('selectAWSAuthenticationMethod', method => {
  cy.contains('button', 'Select').click()
  cy.contains('button', 'Enter your AWS Access Key').click()
})

// TODO abstract this into a function that just takes a selection and move it into another module
Cypress.Commands.add('awsCompleteEnvironmentDialog', options => {
  const {
    chooseCloudProvider,
    environmentName
  } = Object.assign({
    chooseCloudProvider: true,
    environmentName: ENVIRONMENT_NAME
  }, options)

  cy.get(ENVIRONMENT_NAME_INPUT).type(environmentName)
  if(chooseCloudProvider) {
    cy.get(CLOUD_PROVIDER_DROPDOWN).click()
    cy.get(ENV_OPTION_AWS).click()
  }
  cy.contains('button', 'Next').click()
})

// TODO support other auth methods
Cypress.Commands.add('awsAuthenticateEnvironment', options => {
  const {
    authMethod
  } = Object.assign({
    authMethod: 'token'
  }, options)

  cy.selectAWSAuthenticationMethod(authMethod)
  cy.contains('AWS Access key ID').next().type(AWS_ACCESS_KEY)

  cy.contains('AWS Secret access key').next().type(AWS_SECRET_ACCESS_KEY)
  cy.contains('button', 'Save').click()
  cy.url().should('not.include', '/dashboard/-/clusters')
})

Cypress.Commands.add('createAWSEnvironment', (options) => {
  const { environmentName, shouldCreateExternalResource } = Object.assign(
    {
      environmentName: ENVIRONMENT_NAME,
    },
    options
  )

  cy.visit(`${BASE_URL}/dashboard/environments`)
  createEnvironmentButton().click()
  cy.awsCompleteEnvironmentDialog({environmentName})
  cy.url().should('not.include', '/dashboard/environments')
  cy.awsAuthenticateEnvironment()
  cy.contains(environmentName).should('exist')

  // create external resource
  if (shouldCreateExternalResource) {
    cy.createDigitalOceanDNSInstance(environmentName)
  }
});
