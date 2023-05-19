const FIXTURE = 'generated/deployments/_cy-k8s-secondary-gcprvdt9055__nextcloud__gcp-sql'
const USERNAME = Cypress.env('OC_IMPERSONATE')
const BASE_TIMEOUT = Cypress.env('BASE_TIMEOUT')
const GCP_DNS_ZONE = Cypress.env('GCP_DNS_ZONE')

describe('K8s as a secondary provider (gcp)', () => {
  const baseTitle = 'Cy-k8s-secondary' 
  const suffix = Date.now().toString(36).slice(4) + Math.random().toString().slice(-4)
  const environmentName = `${baseTitle}-gcp${suffix}`.toLowerCase()

  it('Can create an environment', () => {
    cy.createGCPEnvironment({
      environmentName,
      shouldCreateExternalResource: true,
      shouldCreateDNS: true
    })

    cy.contains('button', 'Add a Provider').click()
    cy.get('[data-testid="resource-selection-unfurl.relationships.ConnectsTo.K8sCluster"]').click()
    cy.contains('button:visible', 'Next').click()

    cy.enterK8sInfo('kubernetes')
    cy.get('#providerModal').within(() => {
      cy.contains('button', 'Save Changes').click()
    })

    cy.wait(5000)

    cy.addK8sAnnotations()

    cy.saveExternalResources()
  })

  it('Can deploy with GCP resources', () => {
    cy.recreateDeployment({
      fixture: FIXTURE,
      title: `${baseTitle}-${FIXTURE.split('_').pop()}${suffix}`,
      env: environmentName,
      dnsZone: GCP_DNS_ZONE
    })
  })
})
