describe('_production-gcp__nextcloud__mail-and-pg', () => {
  it('Can recreate deployment', () => {
    cy.recreateDeployment('generated/deployments/_production-gcp__nextcloud__mail-and-pg')
  })
})
