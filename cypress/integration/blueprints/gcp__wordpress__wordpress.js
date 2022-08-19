describe('_production-gcp__wordpress__wordpress', () => {
  it('Can recreate deployment', () => {
    cy.recreateDeployment('generated/deployments/_production-gcp__wordpress__wordpress')
  })
})
