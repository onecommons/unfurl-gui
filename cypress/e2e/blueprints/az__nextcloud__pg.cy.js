describe('az__nextcloud__pg', () => {
  it('Can recreate deployment', () => {
    cy.recreateDeployment('generated/deployments/_az__nextcloud__pg')
  })
})
