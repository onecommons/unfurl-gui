describe('_production-gcp__nextcloud__only-mail', () => {
  it('Can recreate deployment', () => {
    cy.recreateDeployment('generated/deployments/_production-gcp__nextcloud__only-mail')
  })
})
