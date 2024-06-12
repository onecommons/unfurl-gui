const ENVIRONMENT_NAME = Cypress.env('AWS_ENVIRONMENT_NAME')
const AWS_ACCESS_KEY = Cypress.env('AWS_ACCESS_KEY_ID')
const AWS_SECRET_ACCESS_KEY = Cypress.env('AWS_SECRET_ACCESS_KEY')
const REPOS_NAMESPACE = Cypress.env('REPOS_NAMESPACE')
const BASE_TIMEOUT = Cypress.env('BASE_TIMEOUT')
const AWS_DNS_ZONE = Cypress.env('AWS_DNS_ZONE')
const AWS_DNS_TYPE = Cypress.env('AWS_DNS_TYPE')
const AWS_DEFAULT_REGION = Cypress.env('AWS_DEFAULT_REGION')
const USERNAME = Cypress.env('OC_IMPERSONATE')
const DASHBOARD_DEST = Cypress.env('DASHBOARD_DEST')

const createEnvironmentButton = () => cy.contains('button', 'Create New Environment', {timeout: BASE_TIMEOUT * 2})
const ENVIRONMENT_NAME_INPUT = '[data-testid="environment-name-input"]'
const CLOUD_PROVIDER_DROPDOWN = '[data-testid="cloud-provider-dropdown"]'
const ENV_OPTION_AWS = `[data-testid="env-option-aws"]`

Cypress.Commands.add('selectAWSRegion', region => {
  cy.contains('Select your region:', {matchCase: false}).next().click()
  cy.contains('button', region).click()
})

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
    authMethod,
    region
  } = Object.assign({
    authMethod: 'token'
  }, options)

  console.log({region})
  if(region) cy.selectAWSRegion(region)
  cy.selectAWSAuthenticationMethod(authMethod)
  cy.contains('AWS Access key ID').next().type(AWS_ACCESS_KEY)

  cy.contains('AWS Secret access key').next().type(AWS_SECRET_ACCESS_KEY)
  cy.contains('button', 'Save').click()
  cy.url().should('not.include', '/dashboard/-/clusters')
})

Cypress.Commands.add('createAWSEnvironment', (options) => {
  const { environmentName, shouldCreateExternalResource, shouldCreateDNS } = Object.assign(
    {
      environmentName: ENVIRONMENT_NAME,
    },
    options
  )

  cy.whenEnvironmentAbsent(environmentName, () => {
    cy.visit(`/${DASHBOARD_DEST}/-/environments`)
    createEnvironmentButton().click()
    cy.awsCompleteEnvironmentDialog({environmentName})
    cy.url().should('include', environmentName)
    cy.awsAuthenticateEnvironment({region: AWS_DEFAULT_REGION})
    cy.contains(environmentName).should('exist')
    cy.contains('Amazon Web Services').should('exist')
  })

  // create external resource
  if (shouldCreateExternalResource) {
    cy.whenInstancesAbsent(environmentName, () => {
      cy.visit(`/${DASHBOARD_DEST}/-/environments/${environmentName}`)
      if(shouldCreateDNS) {
        cy.uncheckedCreateDNS(AWS_DNS_TYPE, AWS_DNS_ZONE)
      }
      cy.uncheckedCreateMail();
      cy.saveExternalResources()
    })
  }
});
