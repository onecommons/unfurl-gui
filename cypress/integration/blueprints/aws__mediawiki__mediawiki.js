describe('_staging-aws__mediawiki__mediawiki', () => {
  it('Can recreate deployment', () => {
    cy.recreateDeployment('generated/deployments/_staging-aws__mediawiki__mediawiki')
  })
})
