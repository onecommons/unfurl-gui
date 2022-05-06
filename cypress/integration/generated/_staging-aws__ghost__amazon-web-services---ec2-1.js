describe('_staging-aws__ghost__amazon-web-services---ec2-1', () => {
  it('Can recreate deployment', () => {
    cy.recreateDeployment('generated/deployments/_staging-aws__ghost__amazon-web-services---ec2-1')
  })
})
