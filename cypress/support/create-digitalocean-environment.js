import {dashboardPath} from './dashboard-path'
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
const DASHBOARD_DEST = Cypress.env('DASHBOARD_DEST')

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
  const { environmentName, shouldCreateExternalResource, shouldCreateDNS } = Object.assign(
    {
      environmentName: ENVIRONMENT_NAME,
    },
    options
  )

  let environmentCreated

  cy.whenEnvironmentAbsent(environmentName, () => {
    cy.visit(dashboardPath(`/-/environments`))
    createEnvironmentButton().click()
    cy.digitalOceanCompleteEnvironmentDialog({environmentName})
    cy.url().should('include', environmentName)
    cy.contains(environmentName).should('exist')
    cy.contains('Digital Ocean').should('exist')

    // Assert the inputs render on the page creation *navigated* to, before any
    // cy.visit below reloads the app. The store is seeded from the write, which
    // carries no `repositories`, so the provider's type could not resolve and
    // the modal opened with no fields -- a bug every reload hid, and every
    // assertion here used to run after one.
    cy.get('[data-testid="edit-provider-primary_provider"]').click()
    cy.get('[data-testid="oc-input-primary_provider-DIGITALOCEAN_TOKEN"]', {timeout: BASE_TIMEOUT})
      .should('exist')
    cy.get('#providerModal button[aria-label="Close"], #providerModal .close').first().click({force: true})

    cy.wait(BASE_TIMEOUT / 2)

    // DigitalOcean has no inline *-provider-setup panel the way aws and gcp do,
    // so its inputs live in the generic #providerModal -- which opens only on
    // `?provider` (environment.vue's showingProviderModal).
    cy.visit(dashboardPath(`/-/environments/${environmentName}?provider`))

    // defaulted rather than required: a dry run never calls DigitalOcean, and an
    // unset variable otherwise fails as `cy.type() ... You passed in: undefined`
    // several steps after the real cause. environments.js already defaults it.
    cy.getInputOrTextarea('[data-testid="oc-input-primary_provider-DIGITALOCEAN_TOKEN"]')
      .type(DIGITALOCEAN_TOKEN || 'cypress-placeholder-not-a-secret')

    if(DO_DEFAULT_REGION) {
      cy.getInputOrTextarea('[data-testid="oc-input-primary_provider-default_region"]').type(DO_DEFAULT_REGION)
    }

    cy.get('#providerModal').within(() => {
      cy.contains('button', 'Save Changes').click()
    })

    environmentCreated = true
    cy.wait(5000)
  })


  // create external resource
  if (shouldCreateExternalResource) {
    cy.whenInstancesAbsent(environmentName, () => {
      environmentCreated || cy.visit(dashboardPath(`/-/environments/${environmentName}`))

      // Saving a provider closes the modal. It used to survive the save:
      // onSaveTemplate defaulted to window.location.reload(), which raced the
      // router push clearing ?provider, so the page came back with the modal
      // open and this click failed as "covered by another element".
      cy.get('.modal.show').should('not.exist')
      cy.contains('a', 'Resources').click()
      if(shouldCreateDNS) {
        cy.uncheckedCreateDNS(AWS_DNS_TYPE, AWS_DNS_ZONE)
      }
      cy.uncheckedCreateMail();
      cy.saveExternalResources()

      cy.checkMail()
    })
  }
});
