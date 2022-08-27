describe('_staging-aws__minecraft__minecraft', () => {
  it('Can recreate deployment', () => {
    cy.recreateDeployment('generated/deployments/_staging-aws__minecraft__minecraft')
  })
})
