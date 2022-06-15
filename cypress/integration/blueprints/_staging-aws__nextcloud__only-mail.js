describe('_staging-aws__nextcloud__only-mail', () => {
  it('Can recreate deployment', () => {
    cy.recreateDeployment('generated/deployments/_staging-aws__nextcloud__only-mail')
  })
})
