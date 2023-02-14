const FIXTURE = 'generated/deployments/_production-gcp__nextcloud__only-mail.json'
const BASE_URL = Cypress.env('OC_URL')
const USERNAME = Cypress.env('OC_IMPERSONATE')
const BASE_TIMEOUT = Cypress.env('BASE_TIMEOUT')
const GCP_DNS_ZONE = Cypress.env('GCP_DNS_ZONE')

describe('Shared dashboard test', () => {
  const baseTitle = 'Shared dashboard env' 
  const suffix = Date.now().toString(36).slice(4) + Math.random().toString().slice(-4)
  const environmentName = `${baseTitle}-gcp${suffix}`.toLowerCase()

  it('Can create an environment with the owner', () => {
    cy.createGCPEnvironment({
      environmentName,
      shouldCreateExternalResource: true,
      shouldCreateDNS: true
    })
  })

  it('Can deploy from another user', () => {
    const username = `shared-dashboard-user-${suffix}`
    cy.execLoud(`yarn create-user --username ${username}`)
    
  })

})

