const BASE_URL = Cypress.env('OC_URL')

describe('GitHub Token', () => {
  it('Can enter personal access token', () => {
    cy.enterGithubToken()
  })
})
