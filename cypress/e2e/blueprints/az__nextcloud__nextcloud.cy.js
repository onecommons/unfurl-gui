describe('nexcloud', () => {
  it('Can recreate deployment', () => {
    cy.recreateDeployment('generated/deployments/_az__nextcloud__nextcloud')
  })
})
