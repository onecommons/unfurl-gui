const BASE_URL = Cypress.env('OC_URL')
const ENVIRONMENT_NAME = 'env-test-' + Cypress.env('AWS_ENVIRONMENT_NAME')
const AWS_ACCESS_KEY = Cypress.env('AWS_ACCESS_KEY_ID')
const AWS_SECRET_ACCESS_KEY = Cypress.env('AWS_SECRET_ACCESS_KEY')
const REPOS_NAMESPACE = Cypress.env('REPOS_NAMESPACE')

const createEnvironmentButton = () => cy.contains('button', 'Create New Environment')
const ENVIRONMENT_NAME_INPUT = '[data-testid="environment-name-input"]'
const CLOUD_PROVIDER_DROPDOWN = '[data-testid="cloud-provider-dropdown"]'
const ENV_OPTION_AWS = `[data-testid="env-option-aws"]`

function selectAuthenticationMethod() {
  cy.contains('button', 'Select').click()
  cy.contains('button', 'Enter your AWS Access Key').click()

}

function completeEnvironmentDialog(chooseCloudProvider=true) {
  cy.get(ENVIRONMENT_NAME_INPUT).type(ENVIRONMENT_NAME)
  if(chooseCloudProvider) {
    cy.get(CLOUD_PROVIDER_DROPDOWN).click()
    cy.get(ENV_OPTION_AWS).click()
  }
  cy.contains('button', 'Next').click()
}

function authenticateWithAccessKeys() {
  selectAuthenticationMethod()
  cy.contains('AWS Access key ID').next().type(AWS_ACCESS_KEY)

  cy.contains('AWS Secret access key').next().type(AWS_SECRET_ACCESS_KEY)
  cy.contains('button', 'Save').click()
  cy.url().should('not.include', '/dashboard/-/clusters')
}

describe('AWS environments', () => {

  it('Can create an aws environment', () => {
    cy.visit(`${BASE_URL}/dashboard/environments`)
    createEnvironmentButton().click()
    cy.get(ENVIRONMENT_NAME_INPUT).type(ENVIRONMENT_NAME)
    cy.get(CLOUD_PROVIDER_DROPDOWN).click()
    cy.get(ENV_OPTION_AWS).click()
    cy.contains('button', 'Next').click()
    cy.url().should('not.include', '/dashboard/environments')
    //cy.visit('http://skelaware.abreidenbach.com:3000/user-2022-04-28T19-34-43-368Z/dashboard/-/clusters/new?env=aws-2022-04-28t20-54-14-353z&provider=aws')

    selectAuthenticationMethod()
    cy.contains('AWS Access key ID').next().type(AWS_ACCESS_KEY)

    cy.contains('AWS Secret access key').next().type(AWS_SECRET_ACCESS_KEY)
    cy.contains('button', 'Save').click()
    cy.url().should('not.include', '/dashboard/-/clusters')
    cy.contains(ENVIRONMENT_NAME).should('exist')
  })

  it('Can delete an aws environment', () => {
    cy.visit(`${BASE_URL}/dashboard/environments/${ENVIRONMENT_NAME}`)
    cy.contains('button', 'Delete Environment', {timeout: 10000}).click({force: true})
    cy.contains('button.js-modal-action-primary', 'Delete').click()
    cy.contains('was deleted successfully').should('be.visible')
  })

  // TODO run delete again to clean up after this
  it('Can create an aws env from the overview page', () => {
    cy.visit(`${BASE_URL}/${REPOS_NAMESPACE}/simple-blueprint`)

    cy.contains('.oc_table_row', 'Amazon Web Services') // TODO replace table row with testid
      .within(() => {
        cy.contains('button', 'Deploy').click()
      })

    cy.get('.dropdown-toggle.btn-default').click() // TODO use a testid
    cy.contains('button', 'Create new environment').click()
    
    completeEnvironmentDialog(false)
    authenticateWithAccessKeys()

    cy.contains('button', ENVIRONMENT_NAME, {timeout: 10000}).should('be.visible')
  })
})
