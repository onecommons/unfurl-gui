describe('_staging-aws__mediawiki__aws-mariadb', () => {
  it('Can recreate deployment', () => {
    cy.recreateDeployment('generated/deployments/_staging-aws__mediawiki__aws-mariadb')
  })
})
