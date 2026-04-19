const ENVIRONMENT_NAME = 'generic'
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
const ENV_OPTION_GENERIC = `[data-testid="env-option-Generic"]`

// TODO abstract this into a function that just takes a selection and move it into another module
Cypress.Commands.add('genericCompleteEnvironmentDialog', options => {
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
    cy.get(ENV_OPTION_GENERIC).click()
  }
  cy.contains('button', 'Next').click()
})

Cypress.Commands.add('createGenericEnvironment', (options) => {
  const { environmentName, shouldCreateExternalResource, shouldCreateDNS } = Object.assign(
    {
      environmentName: ENVIRONMENT_NAME,
    },
    options
  )

  cy.visit(`/${DASHBOARD_DEST}/-/environments`)
  createEnvironmentButton().click()
  cy.genericCompleteEnvironmentDialog({environmentName})
  cy.url().should('include', environmentName)
  cy.contains(environmentName).should('exist')
  cy.contains('Generic').should('exist')

  cy.wait(5000)

  cy.contains('a', 'Resources').click()

  // create external resource
  if (shouldCreateExternalResource) {
    if(shouldCreateDNS) {
      cy.uncheckedCreateDNS(AWS_DNS_TYPE, AWS_DNS_ZONE)
    }
    cy.uncheckedCreateMail();
    cy.saveExternalResources()
  }
});
