describe('_gcp-2022-09-08t16-51-09__nextcloud__memorystore', () => {
  it('Can recreate deployment', () => {
    cy.recreateDeployment('generated/deployments/_gcp-2022-09-08t16-51-09__nextcloud__memorystore')
  })
})
