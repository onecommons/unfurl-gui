describe('_k8s-20221012t165758423z__wordpress__wordpress', () => {
  it('Can recreate deployment', () => {
    cy.recreateDeployment('generated/deployments/_k8s-20221012t165758423z__wordpress__wordpress')
  })
})
