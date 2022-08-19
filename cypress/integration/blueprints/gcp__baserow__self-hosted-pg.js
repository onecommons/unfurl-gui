describe('_production-gcp__baserow__self-hosted-pg', () => {
  it('Can recreate deployment', () => {
    cy.recreateDeployment('generated/deployments/_production-gcp__baserow__self-hosted-pg')
  })
})
