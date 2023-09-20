describe('nestedcloud', () => {
  it('Can recreate deployment', () => {
    cy.recreateDeployment('generated/deployments/_do-20230919t200100977z__nestedcloud__nestedcloud-do-3')
  })
})
