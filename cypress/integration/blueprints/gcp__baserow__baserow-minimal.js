describe('_production-gcp__baserow__baserow-minimal', () => {
  it('Can recreate deployment', () => {
    cy.recreateDeployment('generated/deployments/_production-gcp__baserow__baserow-minimal')
  })
})
