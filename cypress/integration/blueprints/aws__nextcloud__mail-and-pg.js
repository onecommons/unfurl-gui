describe('_staging-aws__nextcloud__mail-and-pg', () => {
  it('Can recreate deployment', () => {
    cy.recreateDeployment('generated/deployments/_staging-aws__nextcloud__mail-and-pg')
  })
})
