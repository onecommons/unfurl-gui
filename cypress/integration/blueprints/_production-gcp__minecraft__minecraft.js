describe('_production-gcp__minecraft__minecraft', () => {
  it('Can recreate deployment', () => {
    cy.recreateDeployment('generated/deployments/_production-gcp__minecraft__minecraft')
  })
})
