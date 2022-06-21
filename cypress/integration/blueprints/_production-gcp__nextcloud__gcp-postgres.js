describe('_production-gcp__nextcloud__gcp-postgres', () => {
  it('Can recreate deployment', () => {
    cy.recreateDeployment('generated/deployments/_production-gcp__nextcloud__gcp-postgres')
  })
})
