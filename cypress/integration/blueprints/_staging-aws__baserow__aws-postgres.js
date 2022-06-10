describe('_staging-aws__baserow__aws-postgres', () => {
  it('Can recreate deployment', () => {
    cy.recreateDeployment('generated/deployments/_staging-aws__baserow__aws-postgres')
  })
})
