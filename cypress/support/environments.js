const BASE_URL = Cypress.env('OC_URL')
const CLOUD_PROVIDER_DROPDOWN = '[data-testid="cloud-provider-dropdown"]'
const ENVIRONMENT_NAME_INPUT = '[data-testid="environment-name-input"]'
const envOptionSelector = provider =>  `[data-testid="env-option-${provider}"]`
const DIGITALOCEAN_TOKEN = Cypress.env('DIGITALOCEAN_TOKEN')
const DIGITALOCEAN_DNS_NAME = Cypress.env('DIGITALOCEAN_DNS_NAME')
const BASE_TIMEOUT = Cypress.env('BASE_TIMEOUT')
const SMTP_HOST = Cypress.env('SMTP_HOST')
const MAIL_RESOURCE_NAME = Cypress.env('MAIL_RESOURCE_NAME') || 'Mail Server'
const MAIL_USERNAME = Cypress.env('MAIL_USERNAME')
const MAIL_PASSWORD = Cypress.env('MAIL_PASSWORD')
import slugify from '../../packages/oc-pages/vue_shared/slugify'

Cypress.Commands.add('withEnvironment', (environmentName, cb) => {
  return cy.waitUntil(() => cy.withStore().then(store => {
    if(!store.getters.environmentsAreReady) return false
    expect(store.getters.lookupVariableByEnvironment('UNFURL_VAULT_DEFAULT_PASSWORD', '*')).to.not.be.null
    return store
  }), {timeout: BASE_TIMEOUT * 2,  interval: 500})
    .then(store => {
      const env = store.getters.lookupEnvironment(environmentName) || null
      cb && cb(env)
      return env
    })
})

Cypress.Commands.add('whenEnvironmentExists', (environmentName, cb) => {
  return cy.withEnvironment(environmentName).then(env => env && cb(env))
})

Cypress.Commands.add('whenEnvironmentAbsent', (environmentName, cb) => {
  return cy.withEnvironment(environmentName).then(env => !env && cb())
})

Cypress.Commands.add('environmentShouldExist', environmentName => {
  //return cy.withEnvironment(environmentName, env => expect(env).to.not.be.undefined)
  return cy.withEnvironment(environmentName).should('exist')
})

Cypress.Commands.add('environmentShouldNotExist', environmentName => {
  //return cy.withEnvironment(environmentName, env => expect(env).to.be.undefined)
  return cy.withEnvironment(environmentName).should('not.exist')
})

Cypress.Commands.add('clickCreateEnvironmentButton', () => {
  cy.contains('button', 'Create New Environment', {timeout: 10000, matchCase: false}).click()
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
  cy.wait(BASE_TIMEOUT) // TODO this isn't very reliable
  // this broke with reloading after saving
  //cy.contains("Environment was saved successfully!").should("exist")

  // check if external instance save properly
  cy.visit(`${BASE_URL}/dashboard/environments/${environmentName}`)
  cy.get(`input[data-testid="oc-input-${digitalOceanName}-name"]`).should(
    "have.value",
    "untrusted.me"
  )
})

Cypress.Commands.add('createMailResource', environmentName => {
  if(! (SMTP_HOST && MAIL_USERNAME && MAIL_PASSWORD)) return
  cy.visit(`${BASE_URL}/dashboard/environments/${environmentName}`)
  cy.wait(BASE_TIMEOUT)
  cy.contains('button', 'Add External Resource').click()
  cy.get('[data-testid="external-resource-tab-SMTPServer"]').click()
  cy.get('[data-testid="resource-selection-GenericSMTPServer"]').click()

  // todo: use a test id for this input, and use different name
  cy.get('input#input2')
    .clear()
    .type(MAIL_RESOURCE_NAME)

  const mailResourceName = slugify(MAIL_RESOURCE_NAME)
  cy.contains("button", "Next").click()
  cy.get(
    `input[data-testid="oc-input-${mailResourceName}-host"]`
  ).type(SMTP_HOST)
  cy.get(`input[data-testid="oc-input-${mailResourceName}-user_name"]`).type(
    MAIL_USERNAME
  )
  cy.get(`input[data-testid="oc-input-${mailResourceName}-password"]`).type(
    MAIL_PASSWORD
  )
  cy.get(`input[data-testid="oc-input-${mailResourceName}-protocol"]`).type(
    'tls'
  )

  cy.wait(BASE_TIMEOUT / 50)
  cy.contains("button", "Save Changes").click()
  cy.wait(BASE_TIMEOUT) // TODO this isn't very reliable
  // this broke with reloading after saving
  //cy.contains("Environment was saved successfully!").should("exist")

  // check if external instance save properly
  cy.visit(`${BASE_URL}/dashboard/environments/${environmentName}`)
  cy.get(`input[data-testid="oc-input-${mailResourceName}-host"]`).should(
    "have.value",
    SMTP_HOST
  )
})
