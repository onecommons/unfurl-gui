describe('_staging-aws__ghost__ghost-official', () => {
  it('Can recreate deployment', () => {
    cy.recreateDeployment('generated/deployments/_staging-aws__ghost__ghost-official')
  })
})
