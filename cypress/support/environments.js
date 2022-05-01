const BASE_URL = Cypress.env('OC_URL')
const CLOUD_PROVIDER_DROPDOWN = '[data-testid="cloud-provider-dropdown"]'
const ENVIRONMENT_NAME_INPUT = '[data-testid="environment-name-input"]'
const envOptionSelector = provider =>  `[data-testid="env-option-${provider}"]`

Cypress.Commands.add('withEnvironment', (environmentName, cb)=> {
  cy.waitUntil(() => cy.window().then(win => {
    return win.$store.getters.environmentsAreReady
  }))

  cy.window().then((win) => {
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

  cy.get(ENVIRONMENT_NAME_INPUT).type(environmentName)
  if(provider) {
    cy.get(CLOUD_PROVIDER_DROPDOWN).click()
    cy.get(envOptionSelector(provider)).click()
  }
  cy.contains('button', 'Next').click()
})



Cypress.Commands.add('deleteEnvironment', environmentName => {
  cy.visit(`${BASE_URL}/dashboard/environments/${environmentName}`)
  cy.wait(5000)
  cy.contains('button', 'Delete Environment', {timeout: 10000}).click({force: true})
  cy.contains('button.js-modal-action-primary', 'Delete').click()
  cy.contains('was deleted successfully', {timeout: 10000}).should('be.visible')
})
