describe('_staging-aws__nextcloud__aws-postgres', () => {
  it('Can recreate deployment', () => {
    cy.recreateDeployment('generated/deployments/_staging-aws__nextcloud__aws-postgres')
  })
})
