describe('_do__nextcloud__only-mail', () => {
  it('Can recreate deployment', () => {
    cy.recreateDeployment('generated/deployments/_do__nextcloud__only-mail')
  })
})
