describe('_staging-aws__baserow__baserow-minimal', () => {
  it('Can recreate deployment', () => {
    cy.recreateDeployment('generated/deployments/_staging-aws__baserow__baserow-minimal')
  })
})
