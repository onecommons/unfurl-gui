describe('_production-gcp__ghost__ghost', () => {
  it('Can recreate deployment', () => {
    cy.recreateDeployment('generated/deployments/_production-gcp__ghost__ghost')
  })
})
