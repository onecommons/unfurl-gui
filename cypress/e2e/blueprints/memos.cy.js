describe('memos', () => {
  it('Can recreate deployment', () => {
    cy.recreateDeployment('generated/deployments/_gcp-20230315t200502713z__memos__memos')
  })
})
