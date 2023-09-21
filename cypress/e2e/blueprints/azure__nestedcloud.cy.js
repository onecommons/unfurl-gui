describe('azure__nestedcloud', () => {
  it('Can recreate deployment', () => {
    cy.recreateDeployment('generated/deployments/_az-20230921t175856209z__nestedcloud__nestedcloud-azure-1')
  })
})
