const BASE_URL = Cypress.env('OC_URL')
const ENVIRONMENT_NAME = Cypress.env('DO_ENVIRONMENT_NAME')
const DO_DEFAULT_REGION = Cypress.env('DO_DEFAULT_REGION')
const DIGITALOCEAN_TOKEN = Cypress.env('DIGITALOCEAN_TOKEN')
const AWS_ACCESS_KEY = Cypress.env('AWS_ACCESS_KEY_ID')
const AWS_SECRET_ACCESS_KEY = Cypress.env('AWS_SECRET_ACCESS_KEY')
const REPOS_NAMESPACE = Cypress.env('REPOS_NAMESPACE')
const BASE_TIMEOUT = Cypress.env('BASE_TIMEOUT')
const AWS_DNS_ZONE = Cypress.env('AWS_DNS_ZONE')
const AWS_DNS_TYPE = Cypress.env('AWS_DNS_TYPE')
const AWS_DEFAULT_REGION = Cypress.env('AWS_DEFAULT_REGION')
const USERNAME = Cypress.env('OC_IMPERSONATE')

const createEnvironmentButton = () => cy.contains('button', 'Create New Environment', {timeout: BASE_TIMEOUT * 2})
const ENVIRONMENT_NAME_INPUT = '[data-testid="environment-name-input"]'
const CLOUD_PROVIDER_DROPDOWN = '[data-testid="cloud-provider-dropdown"]'
const ENV_OPTION_DO = `[data-testid="env-option-DigitalOcean"]`

// TODO abstract this into a function that just takes a selection and move it into another module
Cypress.Commands.add('digitalOceanCompleteEnvironmentDialog', options => {
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
    cy.get(ENV_OPTION_DO).click()
  }
  cy.contains('button', 'Next').click()
})

Cypress.Commands.add('createDigitalOceanEnvironment', (options) => {
  const { environmentName, shouldCreateExternalResource } = Object.assign(
    {
      environmentName: ENVIRONMENT_NAME,
    },
    options
  )

  cy.visit(`${BASE_URL}/${USERNAME}/dashboard/-/environments`)
  createEnvironmentButton().click()
  cy.digitalOceanCompleteEnvironmentDialog({environmentName})
  cy.url().should('include', environmentName)
  cy.contains(environmentName).should('exist')
  cy.contains('Digital Ocean').should('exist')

  cy.wait(BASE_TIMEOUT / 2)

  cy.getInputOrTextarea('[data-testid="oc-input-primary_provider-DIGITALOCEAN_TOKEN"]').type(DIGITALOCEAN_TOKEN)

  if(DO_DEFAULT_REGION) {
    cy.getInputOrTextarea('[data-testid="oc-input-primary_provider-default_region"]').type(DO_DEFAULT_REGION)
  }

  cy.contains('a', 'Resources').click()

  // create external resource
  if (shouldCreateExternalResource) {
    cy.uncheckedCreateDNS(AWS_DNS_TYPE, AWS_DNS_ZONE)
    cy.uncheckedCreateMail();
    cy.saveExternalResources()
  }
});
