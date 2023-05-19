const FIXTURE = 'generated/deployments/_production-gcp__nextcloud__only-mail.json'
const USERNAME = Cypress.env('OC_IMPERSONATE')
const BASE_TIMEOUT = Cypress.env('BASE_TIMEOUT')
const GCP_DNS_ZONE = Cypress.env('GCP_DNS_ZONE')
const INTEGRATION_TEST_ARGS = Cypress.env('INTEGRATION_TEST_ARGS') 

describe('Shared dashboard test', () => {
  const baseTitle = 'shared-dashbaord-env' 
  const suffix = Date.now().toString(36).slice(4) + Math.random().toString().slice(-4)
  const environmentName = `${baseTitle}-gcp${suffix}`.toLowerCase()

  it('Can create an environment with the owner', () => {
    cy.createGCPEnvironment({
      environmentName,
      shouldCreateExternalResource: true,
      shouldCreateDNS: true
    })
  })

  it('Can create a draft from another user', () => {
    const username = `shared-dashboard-user-${suffix}`
    if(INTEGRATION_TEST_ARGS.dashboardRepo) {
      cy.execLoud(`yarn create-user --username ${username} --dashboard ${INTEGRATION_TEST_ARGS.dashboardRepo}`)
    } else {
      cy.execLoud(`yarn create-user --username ${username}`)
    }
    cy.execLoud(`./scripts/src/add-project-member.js --username ${username} --project ${USERNAME}/dashboard --accessLevel 30`)
    cy.logout()
    cy.login(Cypress.env('OC_USERNAME'), Cypress.env('OC_PASSWORD'), username)
    cy.recreateDeployment({
      fixture: 'generated/deployments/_production-gcp__nextcloud__mail-and-pg.json',
      env: environmentName,
      shouldSave: true,
    })

  })

  it('Can deploy the draft', () => {
    cy.logout()
    cy.login(Cypress.env('OC_USERNAME'), Cypress.env('OC_PASSWORD'), USERNAME)
    cy.contains('Merge Request').click()
    cy.contains('[Draft]').click()
    cy.contains('a.btn.gl-button.js-draft-toggle-button.btn-confirm-secondary', 'Mark as ready').first().click()
    cy.wait(BASE_TIMEOUT / 2)
    cy.get('[data-testid="merge-button"]').click()
    cy.contains('.detail-page-header-body', 'Merged').should('exist')
    cy.wait(BASE_TIMEOUT / 2)
    cy.get('[data-qa-selector="description_content"]').within(() => {
      cy.contains('a', 'cy-mail-and-pg').click()
    })
    cy.wait(BASE_TIMEOUT / 2)
    cy.get('[data-testid="tab-inputs-self-hosted-postgresdb"]').click()
    cy.contains('button', 'Generate').click()

    cy.get('[data-testid="deploy-button"]').click()
    cy.wait(BASE_TIMEOUT / 2)

    cy.contains('a', 'Console').should('exist')

    cy.withJob((job) => {
      cy.expectSuccessfulJob(job)
    })

    cy.get('[data-testid="status_success_solid-icon"]').should('be.visible')
    cy.get('[data-testid="ellipsis_v-icon"]').click()

    cy.contains('button', 'Teardown').click()
    cy.contains('button', 'Confirm').click()

  })

})

