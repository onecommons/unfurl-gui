describe('_production-gcp__nextcloud__redis-mail-pg', () => {
  it('Can recreate deployment', () => {
    cy.recreateDeployment('generated/deployments/_production-gcp__nextcloud__redis-mail-pg')
  })
})
