describe('$TEST_NAME', () => {
  it('Can recreate deployment', () => {
    cy.recreateDeployment('$FIXTURE_PATH')
  })
})
