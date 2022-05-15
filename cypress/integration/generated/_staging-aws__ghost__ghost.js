describe('_staging-aws__ghost__ghost', () => {
  it('Can recreate deployment', () => {
    cy.recreateDeployment('generated/deployments/_staging-aws__ghost__ghost')
  })
})
