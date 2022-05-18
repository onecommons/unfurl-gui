describe('_staging-aws__simple-blueprint__amazon-web-services-ec2-1', () => {
  it('Can recreate deployment', () => {
    cy.recreateDeployment('generated/deployments/_staging-aws__simple-blueprint__amazon-web-services-ec2-1')
  })
})
