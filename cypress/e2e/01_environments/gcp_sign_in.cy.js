import {dashboardPath} from '../../support/dashboard-path'

// Google is the third party here, so the consent screen is where this stops:
// the first case asserts the browser asks our server to start the flow, the
// rest resume from the marker the callback returns with and stub what the
// server would have had a token for.
const BASE_TIMEOUT = Cypress.env('BASE_TIMEOUT')
const ENVIRONMENT_NAME = 'env-test-signin-' + Cypress.env('GCP_ENVIRONMENT_NAME')
const GCP_ZONE = Cypress.env('GCP_ZONE') || 'us-central1-a'

const PROJECTS = [
  {project_id: 'unfurl-cloud-1234', name: 'Unfurl Cloud'},
  {project_id: 'another-project-5678', name: 'Another Project'},
]

function createEnvironment() {
  cy.visit(dashboardPath('/-/environments'))
  cy.clickCreateEnvironmentButton()
  cy.completeEnvironmentDialog({environmentName: ENVIRONMENT_NAME, provider: 'gcp'})
  cy.get('[data-testid="gcp-provider-setup"]', {timeout: BASE_TIMEOUT * 2}).should('be.visible')
}

describe('GCP Google sign-in', () => {
  beforeEach(() => {
    cy.whenEnvironmentExists(ENVIRONMENT_NAME, () => {
      cy.deleteEnvironment(ENVIRONMENT_NAME)
    })
    cy.environmentShouldNotExist(ENVIRONMENT_NAME)
  })

  it('asks the server to start the flow, with a return path on this origin', () => {
    // stubbed rather than followed: the 302 to Google is the server's business
    // and going there would take the browser off this instance
    cy.intercept('GET', '**/provider/gcp/authorize*', {statusCode: 204}).as('authorize')

    createEnvironment()
    cy.get('[data-testid="gcp-sign-in-with-google"]').click()

    cy.wait('@authorize').its('request.url').should(
      'include',
      encodeURIComponent(`/-/environments/${ENVIRONMENT_NAME}?provider=gcp&signed_in=1`)
    )
  })

  it('picks a project and zone, then bootstraps the service account', () => {
    cy.intercept('GET', '**/provider/gcp/projects', {body: PROJECTS}).as('gcpProjects')
    cy.intercept('PUT', '**/-/environments/*/provider', {
      statusCode: 200,
      body: {provider: 'gcp', gcp_project_id: PROJECTS[0].project_id, zone: GCP_ZONE, access_token_usable: true},
    }).as('saveProvider')
    cy.intercept('POST', '**/-/deployments/new').as('triggerDeployment')

    createEnvironment()
    // the callback lands back here with the marker
    cy.visit(dashboardPath(`/-/environments/${ENVIRONMENT_NAME}?provider=gcp&signed_in=1`))
    cy.wait('@gcpProjects')

    // the dropdown lists the projects by name and saves the id
    cy.get('[data-testid="gcp-project-dropdown"] [data-testid="base-dropdown-toggle"]').click()
    cy.getInputOrTextarea('[placeholder="Search projects"]').type(PROJECTS[0].name)
    cy.get(`[data-testid="listbox-item-${PROJECTS[0].project_id}"]`).click()

    cy.get('[data-testid="gcp-zone-dropdown"] [data-testid="base-dropdown-toggle"]').click()
    cy.getInputOrTextarea('[placeholder="Search zones"]').type(GCP_ZONE)
    cy.get(`[data-testid="listbox-item-${GCP_ZONE}"]`).click()

    cy.get('[data-testid="gcp-provider-save"]').click()

    cy.wait('@saveProvider').its('request.body').should('deep.equal', {
      provider: 'gcp',
      gcp_project_id: PROJECTS[0].project_id,
      zone: GCP_ZONE,
    })

    // the Google token lives an hour, so the deployment that uses it to create
    // the service account has to run in this page session
    cy.wait('@triggerDeployment', {timeout: BASE_TIMEOUT * 4}).then(({request}) => {
      const variables = request.body.pipeline.variables_attributes
      const byKey = Object.fromEntries(variables.map(v => [v.key, v.secret_value]))
      expect(byKey.DEPLOY_PATH).to.equal(`environments/${ENVIRONMENT_NAME}/primary_provider`)
      expect(byKey.DEPLOYMENT).to.equal('primary_provider')
      expect(byKey.SYSTEM_DEPLOYMENT).to.equal('1')
    })

    cy.get('[data-testid="gcp-provider-setup"]').should('not.exist')
  })

  it('goes back to the sign-in button when the token has expired', () => {
    cy.intercept('GET', '**/provider/gcp/projects', {
      statusCode: 422,
      body: {message: 'Google Cloud authorizations required'},
    }).as('gcpProjects')

    createEnvironment()
    cy.visit(dashboardPath(`/-/environments/${ENVIRONMENT_NAME}?provider=gcp&signed_in=1`))
    cy.wait('@gcpProjects')

    cy.contains('Google Cloud authorizations required').should('be.visible')
    cy.get('[data-testid="gcp-sign-in-with-google"]').should('be.visible')
  })
})
