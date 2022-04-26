describe('_production-gcp__simple-blueprint__google-cloud-platform-1', () => {
  it('Can recreate deployment', () => {
    cy.recreateDeployment('generated/deployments/_production-gcp__simple-blueprint__google-cloud-platform-1')
  })
})
