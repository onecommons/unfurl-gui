describe('aws__nestedcloud', () => {
  it('Can recreate deployment', () => {
    cy.recreateDeployment('generated/deployments/_aws__nestedcloud__nestedcloud-aws-1')
  })
})
