describe('nestedcloud', () => {
  it('Can recreate deployment', () => {
    cy.recreateDeployment('generated/deployments/_gcp-20230823t225516329z__nestedcloud__nestedcloud-gcp-1')
  })
})
