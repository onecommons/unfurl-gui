describe('_production-gcp__baserow__google-cloud-postgres', () => {
  it('Can recreate deployment', () => {
    cy.recreateDeployment('generated/deployments/_production-gcp__baserow__google-cloud-postgres')
  })
})
