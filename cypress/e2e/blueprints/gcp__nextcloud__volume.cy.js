describe('_gcp__nextcloud__volume', () => {
  it('Can recreate deployment', () => {
    cy.recreateDeployment('generated/deployments/_gcp__nextcloud__volume')
  })
})
