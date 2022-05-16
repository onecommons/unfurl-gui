const BASE_URL = Cypress.env('OC_URL')
const CLOUD_PROVIDER_DROPDOWN = '[data-testid="cloud-provider-dropdown"]'
const ENVIRONMENT_NAME_INPUT = '[data-testid="environment-name-input"]'
const envOptionSelector = provider =>  `[data-testid="env-option-${provider}"]`
const DIGITALOCEAN_TOKEN = Cypress.env('DIGITALOCEAN_TOKEN')
const DIGITALOCEAN_DNS_NAME = Cypress.env('DIGITALOCEAN_DNS_NAME')
const BASE_TIMEOUT = Cypress.env('BASE_TIMEOUT')
import slugify from '../../packages/oc-pages/vue_shared/slugify'

Cypress.Commands.add('withEnvironment', (environmentName, cb)=> {
  cy.waitUntil(() => cy.window().then(win => {
    return win.$store.getters.environmentsAreReady
  }), {timeout: BASE_TIMEOUT * 2,  interval: 500})

  cy.window().then((win) => {
    // this will be run quite frequently because environment tests check if they should run cleanup before executing
    // this is a good place to add sanity checks for environments
    expect(win.$store.getters.lookupVariableByEnvironment('UNFURL_VAULT_DEFAULT_PASSWORD', '*')).to.not.be.null
    const env = win.$store.getters.getEnvironments.find(env => env.name == environmentName)
    cb(env)
  })
})

Cypress.Commands.add('whenEnvironmentExists', (environmentName, cb) => {
  return cy.withEnvironment(environmentName, env => env && cb(env))
})

Cypress.Commands.add('whenEnvironmentAbsent', (environmentName, cb) => {
  return cy.withEnvironment(environmentName, env => !env && cb())
})

Cypress.Commands.add('environmentShouldExist', environmentName => {
  return cy.withEnvironment(environmentName, env => expect(env).to.not.be.undefined)
})

Cypress.Commands.add('environmentShouldNotExist', environmentName => {
  return cy.withEnvironment(environmentName, env => expect(env).to.be.undefined)
})

Cypress.Commands.add('clickCreateEnvironmentButton', () => {
  const createEnvironmentButton = () => cy.contains('button', 'Create New Environment', {timeout: 10000, matchCase: false})
  createEnvironmentButton().click()
})

Cypress.Commands.add('completeEnvironmentDialog', options => {
  const {
    environmentName,
    provider
  } = Object.assign({
  }, options)

  cy.wait(BASE_TIMEOUT / 25)
  cy.get(ENVIRONMENT_NAME_INPUT).type(environmentName)
  if(provider) {
    cy.get(CLOUD_PROVIDER_DROPDOWN).click()
    cy.wait(BASE_TIMEOUT / 50)
    cy.get(envOptionSelector(provider)).click()
  }
  cy.contains('button', 'Next').click()
})

Cypress.Commands.add('deleteEnvironment', environmentName => {
  cy.visit(`${BASE_URL}/dashboard/environments/${environmentName}`)
  cy.wait(BASE_TIMEOUT)
  cy.contains('button', 'Delete Environment', {timeout: BASE_TIMEOUT * 2}).click({force: true})
  cy.contains('button.js-modal-action-primary', 'Delete').click()
  cy.contains('was deleted successfully', {timeout: BASE_TIMEOUT * 2}).should('be.visible')
})

Cypress.Commands.add('createDigitalOceanDNSInstance', environmentName => {
  cy.visit(`${BASE_URL}/dashboard/environments/${environmentName}`)
  cy.wait(BASE_TIMEOUT)
  cy.contains('button', 'Add External Resource').click()
  cy.get('[data-testid="external-resource-tab-unfurl.nodes.DNSZone"]').click()
  cy.get('[data-testid="resource-selection-DigitalOceanDNSZone"]').click()

  // todo: use a test id for this input, and use different name
  cy.get('input#input2')
    .clear()
    .type(DIGITALOCEAN_DNS_NAME || "DigitalOceanDNSZone")

  const digitalOceanName = slugify(DIGITALOCEAN_DNS_NAME || "DigitalOceanDNSZone")
  cy.contains("button", "Next").click()
  cy.get(
    `input[data-testid="oc-input-${digitalOceanName}-DIGITALOCEAN_TOKEN"]`
  ).type(DIGITALOCEAN_TOKEN || "default")
  cy.get(`input[data-testid="oc-input-${digitalOceanName}-name"]`).type(
    "untrusted.me"
  )
  cy.wait(BASE_TIMEOUT / 50)
  cy.contains("button", "Save Changes").click()
  cy.wait(BASE_TIMEOUT)
  cy.contains("Environment was saved successfully!").should("exist")

  // check if external instance save properly
  cy.visit(`${BASE_URL}/dashboard/environments/${environmentName}`)
  cy.get(`input[data-testid="oc-input-${digitalOceanName}-name"]`).should(
    "have.value",
    "untrusted.me"
  )
})
