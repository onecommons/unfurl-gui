describe('_k8s-20221012t165758423z__simple-blueprint__simple-blueprint', () => {
  it('Can recreate deployment', () => {
    cy.recreateDeployment('generated/deployments/_k8s-20221012t165758423z__simple-blueprint__simple-blueprint')
  })
})
