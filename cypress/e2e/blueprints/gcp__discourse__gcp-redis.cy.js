describe('gcp__discourse__gcp-redis', () => {
  it('Can recreate deployment', () => {
    cy.recreateDeployment('generated/deployments/_gcp__discourse__discourse-gcp-3b')
  })
})
