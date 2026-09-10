import {dashboardPath} from './dashboard-path'
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

  cy.visit(dashboardPath(`/-/environments`))
  // the table re-renders as environments arrive, which detaches the button
  // between cy.contains and .click() -- wait for the store to settle first
  cy.withStore()
  createEnvironmentButton().should('be.visible').click()
  cy.genericCompleteEnvironmentDialog({environmentName})
  // The page carries the name only as a disabled input's value, which
  // cy.contains cannot see; the breadcrumb that does carry it as text is
  // injected by GitLab's own app and arrives after our timeout. Assert
  // oc-pages' own DOM instead.
  cy.get('[data-testid="dashboard-environment-page"]', {timeout: BASE_TIMEOUT * 2})
    .find('input')
    .first()
    .should('have.value', environmentName)
  // a generic environment has no primary provider, so cloudProviderDisplayName
  // falls back to this -- there is no oc-card on this page to assert against
  cy.contains('Self-Hosted').should('exist')

  cy.wait(5000)

  cy.contains('a', 'Resources').click()

  // create external resource
  if (shouldCreateExternalResource) {
    if(shouldCreateDNS) {
      cy.uncheckedCreateDNS(AWS_DNS_TYPE, AWS_DNS_ZONE)
    }
    cy.uncheckedCreateMail();
    cy.saveExternalResources()

    // checkMail only reads the inputs on the current page, which we just typed
    // into -- reload from the server first so this asserts the save persisted
    // rather than that the form still holds our own input.
    cy.visit(dashboardPath(`/-/environments/${environmentName}`))
    cy.checkMail()
  }
});
