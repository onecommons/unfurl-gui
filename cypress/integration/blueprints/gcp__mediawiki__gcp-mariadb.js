describe('_production-gcp__mediawiki__gcp-mariadb', () => {
  it('Can recreate deployment', () => {
    cy.recreateDeployment('generated/deployments/_production-gcp__mediawiki__gcp-mariadb')
  })
})
