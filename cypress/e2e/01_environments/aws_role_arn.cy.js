import {dashboardPath} from '../../support/dashboard-path'
import {DANGER_ALERT} from '../../support/alerts'

// The role-ARN methods need an AWS account that trusts this instance, so the
// server side is stubbed here and the spec covers what the browser does: the
// account and external ids the user copies into AWS, the ARN it sends back, and
// what happens to the message when AWS refuses.
const BASE_TIMEOUT = Cypress.env('BASE_TIMEOUT')
const ENVIRONMENT_NAME = 'env-test-arn-' + Cypress.env('AWS_ENVIRONMENT_NAME')

const ACCOUNT_ID = '123456789012'
const EXTERNAL_ID = 'external-id-for-this-user'
const ROLE_ARN = 'arn:aws:iam::210987654321:role/UnfurlDeployRole'

function stubRole() {
  cy.intercept('GET', '**/provider/aws/role', {
    body: {account_id: ACCOUNT_ID, external_id: EXTERNAL_ID, role_arn: null},
  }).as('awsRole')
}

function openPanel() {
  cy.visit(dashboardPath('/-/environments'))
  cy.clickCreateEnvironmentButton()
  cy.completeEnvironmentDialog({environmentName: ENVIRONMENT_NAME, provider: 'aws'})
  cy.get('[data-testid="aws-provider-setup"]', {timeout: BASE_TIMEOUT * 2}).should('be.visible')
}

function chooseManualArn() {
  cy.get('[data-testid="aws-method-dropdown"]').click()
  cy.contains('button', 'Create a Role ARN manually').click()
  cy.wait('@awsRole')
}

describe('AWS role ARN', () => {
  beforeEach(() => {
    cy.whenEnvironmentExists(ENVIRONMENT_NAME, () => {
      cy.deleteEnvironment(ENVIRONMENT_NAME)
    })
    cy.environmentShouldNotExist(ENVIRONMENT_NAME)
    stubRole()
  })

  it('offers the ids AWS needs and refuses an ARN that is not one', () => {
    openPanel()
    chooseManualArn()

    cy.get('[data-testid="aws-account-id"]').should('have.value', ACCOUNT_ID)
    cy.get('[data-testid="aws-external-id"]').should('have.value', EXTERNAL_ID)
    cy.get('[data-testid="aws-provider-save"]').should('be.disabled')

    cy.get('[data-testid="aws-role-arn"]').type('arn:aws:iam::nope:role/Whatever')
    cy.get('[data-testid="aws-provider-save"]').should('be.disabled')

    cy.get('[data-testid="aws-role-arn"]').clear().type(ROLE_ARN)
    cy.get('[data-testid="aws-provider-save"]').should('not.be.disabled')
  })

  it('shows what AWS said and stays put when the role refuses us', () => {
    cy.intercept('PUT', '**/-/environments/*/provider', {
      statusCode: 422,
      body: {message: 'User is not authorized to perform: sts:AssumeRole'},
    }).as('saveProvider')

    openPanel()
    chooseManualArn()
    cy.get('[data-testid="aws-role-arn"]').type(ROLE_ARN)
    cy.get('[data-testid="aws-provider-save"]').click()

    cy.wait('@saveProvider')
    cy.get(DANGER_ALERT).should('be.visible')
    cy.contains('sts:AssumeRole').should('be.visible')
    // the user fixes the role in AWS and tries again; nothing was torn down
    cy.get('[data-testid="aws-provider-setup"]').should('be.visible')
  })

  it('records the role against the environment', () => {
    cy.intercept('PUT', '**/-/environments/*/provider', {
      statusCode: 200,
      body: {provider: 'aws', region: 'us-east-2', role_arn: ROLE_ARN, access_token_usable: false},
    }).as('saveProvider')

    openPanel()
    cy.selectAWSRegion('eu-west-1')
    chooseManualArn()
    cy.get('[data-testid="aws-role-arn"]').type(ROLE_ARN)
    cy.get('[data-testid="aws-provider-save"]').click()

    cy.wait('@saveProvider').its('request.body').should('deep.equal', {
      provider: 'aws',
      region: 'eu-west-1',
      role_arn: ROLE_ARN,
    })

    cy.get('[data-testid="aws-provider-setup"]').should('not.exist')
    cy.contains('Amazon Web Services').should('be.visible')
  })
})
