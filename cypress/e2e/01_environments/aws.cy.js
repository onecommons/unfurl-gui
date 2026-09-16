const ENVIRONMENT_NAME = 'env-test-' + Cypress.env('AWS_ENVIRONMENT_NAME')
const AWS_ACCESS_KEY = Cypress.env('AWS_ACCESS_KEY_ID')
const AWS_SECRET_ACCESS_KEY = Cypress.env('AWS_SECRET_ACCESS_KEY')
const REPOS_NAMESPACE = Cypress.env('REPOS_NAMESPACE')
const SIMPLE_BLUEPRINT = Cypress.env('SIMPLE_BLUEPRINT')
const DASHBOARD_DEST = Cypress.env('DASHBOARD_DEST')
const AWS_DEFAULT_REGION = Cypress.env('AWS_DEFAULT_REGION') || 'us-east-2'
// any region the harness does not already use, so the change is observable
const EDITED_REGION = AWS_DEFAULT_REGION === 'us-west-1'? 'us-east-2': 'us-west-1'

const createEnvironmentButton = () => cy.contains('button', 'Create New Environment', {timeout: 10000, matchCase: false})
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
  // the panel is part of the environment page now, so there is no navigation
  // to assert on -- what says it saved is the page coming back
  cy.get('[data-testid="aws-provider-setup"]', {timeout: 10000}).should('not.exist')
}

describe('AWS environments', () => {

  beforeEach(() => {
    cy.whenEnvironmentExists(ENVIRONMENT_NAME, () => {
      cy.deleteEnvironment(ENVIRONMENT_NAME)
    })
    cy.environmentShouldNotExist(ENVIRONMENT_NAME)
  })

  afterEach(() => {
    cy.contains('.properties-list-container', 'Generic', {matchCase: false}).should('not.exist')
    cy.visit(`/${DASHBOARD_DEST}/-/environments`)
    cy.environmentShouldExist(ENVIRONMENT_NAME)
  })

  it('Can create an aws environment', () => {
    cy.createAWSEnvironment({
      environmentName: ENVIRONMENT_NAME,
      shouldCreateExternalResource: true,
    })
  })

  // The gap the other specs in this file leave: they only ever create a
  // provider. Editing one has its own entry point, its own presentation, and
  // seeds its fields from stored variables -- none of which creation exercises.
  it('Can edit an existing aws provider', () => {
    cy.createAWSEnvironment({environmentName: ENVIRONMENT_NAME})

    cy.get('[data-testid="edit-provider-aws"]', {timeout: 10000}).click()
    cy.get('[data-testid="aws-provider-setup"]').should('be.visible')

    // what was saved comes back
    cy.get('[data-testid="aws-region-dropdown"]').should('contain', AWS_DEFAULT_REGION)
    cy.get('[data-testid="aws-access-key-id"]').should('have.value', AWS_ACCESS_KEY)
    // write-only, so it stays blank and says why
    cy.get('[data-testid="aws-secret-access-key"]')
      .should('have.value', '')
      .and('have.attr', 'placeholder', 'Leave blank to keep the current secret')

    // changing only the region must not require re-entering the secret
    cy.get('[data-testid="aws-region-dropdown"]').click()
    cy.contains('.dropdown-item', EDITED_REGION).click()
    cy.get('[data-testid="aws-provider-save"]').should('not.be.disabled').click()
    cy.get('[data-testid="aws-provider-setup"]', {timeout: 10000}).should('not.exist')

    // reload rather than trust the form: the access key must have survived a
    // save that left its field empty
    cy.visit(`/${DASHBOARD_DEST}/-/environments/${ENVIRONMENT_NAME}`)
    cy.get('[data-testid="edit-provider-aws"]', {timeout: 10000}).click()
    cy.get('[data-testid="aws-access-key-id"]').should('have.value', AWS_ACCESS_KEY)
    cy.get('[data-testid="aws-region-dropdown"]').should('contain', EDITED_REGION)
  })

  it('Can create an aws env from the overview page', () => {
    cy.visit(`/${REPOS_NAMESPACE}/${SIMPLE_BLUEPRINT}/-/overview`)

    cy.contains('.oc_table_row', 'Amazon Web Services') // TODO replace table row with testid
      .within(() => {
        cy.contains('button', 'Deploy').click()
      })

    cy.get('.dropdown-toggle.btn-default').click() // TODO use a testid
    createEnvironmentButton().click()

    completeEnvironmentDialog(false)
    authenticateWithAccessKeys()

    // The only <button> carrying the name is the entry in the environment
    // dropdown, which is a closed menu -- so `be.visible` asserted that a
    // correctly hidden menu item was showing. The name is also rendered
    // visibly beside the environment icon, but that node is not a button and
    // has no testid. Assert the durable outcome instead: the new environment
    // exists and is offered for selection.
    cy.get(`[data-testid="deployment-environment-selection-${ENVIRONMENT_NAME}"]`, {timeout: 10000})
      .should('exist')

  })

})
