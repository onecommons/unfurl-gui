const ENVIRONMENT_NAME = Cypress.env('AZ_ENVIRONMENT_NAME')
const ARM_CLIENT_ID = Cypress.env('ARM_CLIENT_ID')
const ARM_TENANT_ID = Cypress.env('ARM_TENANT_ID')
const ARM_SUBSCRIPTION_ID = Cypress.env('ARM_SUBSCRIPTION_ID')
const ARM_CLIENT_SECRET = Cypress.env('ARM_CLIENT_SECRET')
const AZURE_RESOURCE_GROUP = Cypress.env('AZURE_RESOURCE_GROUP')
const AZURE_SUBNET = Cypress.env('AZURE_SUBNET')
const AZURE_VIRTUAL_NETWORK = Cypress.env('AZURE_VIRTUAL_NETWORK')


const REPOS_NAMESPACE = Cypress.env('REPOS_NAMESPACE')
const BASE_TIMEOUT = Cypress.env('BASE_TIMEOUT')
const USERNAME = Cypress.env('OC_IMPERSONATE')
const DASHBOARD_DEST = Cypress.env('DASHBOARD_DEST')

const createEnvironmentButton = () => cy.contains('button', 'Create New Environment', {timeout: BASE_TIMEOUT * 2})
const ENVIRONMENT_NAME_INPUT = '[data-testid="environment-name-input"]'
const CLOUD_PROVIDER_DROPDOWN = '[data-testid="cloud-provider-dropdown"]'
const ENV_OPTION_AZ = '[data-testid="env-option-azure"]'

const AWS_DNS_ZONE = Cypress.env('AWS_DNS_ZONE')
const AWS_DNS_TYPE = Cypress.env('AWS_DNS_TYPE')
const AWS_DEFAULT_REGION = Cypress.env('AWS_DEFAULT_REGION')


Cypress.Commands.add('azCompleteEnvironmentDialog', options => {
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
    cy.get(ENV_OPTION_AZ).click()
  }
  cy.contains('button', 'Next').click()
})


Cypress.Commands.add('createAzEnvironment', (options) => {
  const { environmentName, shouldCreateExternalResource, shouldCreateDNS } = Object.assign(
    {
      environmentName: ENVIRONMENT_NAME,
    },
    options
  )

  cy.whenEnvironmentAbsent(environmentName, () => {
    cy.visit(`/${DASHBOARD_DEST}/-/environments`)
    createEnvironmentButton().click()
    cy.azCompleteEnvironmentDialog({environmentName})
    cy.url().should('include', environmentName)
    cy.contains(environmentName).should('exist')
    cy.contains('Azure').should('exist')

    cy.wait(BASE_TIMEOUT / 2)

    //cy.visit(`/${DASHBOARD_DEST}/-/environments/${environmentName}?provider`)

    cy.getInputOrTextarea('[data-testid="oc-input-primary_provider-AZURE_CLIENT_ID"]').type(ARM_CLIENT_ID)
    cy.getInputOrTextarea('[data-testid="oc-input-primary_provider-AZURE_SECRET"]').type(ARM_CLIENT_SECRET)
    cy.getInputOrTextarea('[data-testid="oc-input-primary_provider-AZURE_SUBSCRIPTION_ID"]').type(ARM_SUBSCRIPTION_ID)
    cy.getInputOrTextarea('[data-testid="oc-input-primary_provider-AZURE_TENANT"]').type(ARM_TENANT_ID)
    cy.getInputOrTextarea('[data-testid="oc-input-primary_provider-resource_group"]').type(AZURE_RESOURCE_GROUP)
    cy.getInputOrTextarea('[data-testid="oc-input-primary_provider-subnet"]').type(AZURE_SUBNET)
    cy.getInputOrTextarea('[data-testid="oc-input-primary_provider-virtual_network"]').type(AZURE_VIRTUAL_NETWORK)
    cy.wait(200)

    cy.get('#providerModal').within(() => {
      cy.contains('button', 'Save Changes').click()
    })

    cy.wait(5000)
  })

  cy.contains('a', 'Resources').click()

  // create external resource
  if (shouldCreateExternalResource) {
    cy.whenInstancesAbsent(environmentName, () => {
      if(shouldCreateDNS) {
        cy.uncheckedCreateDNS(AWS_DNS_TYPE, AWS_DNS_ZONE)
      }
      cy.uncheckedCreateMail();
      cy.saveExternalResources()
    })
  }
});
