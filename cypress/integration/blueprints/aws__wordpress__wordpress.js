describe('_staging-aws__wordpress__wordpress', () => {
  it('Can recreate deployment', () => {
    cy.recreateDeployment('generated/deployments/_staging-aws__wordpress__wordpress')
  })
})
