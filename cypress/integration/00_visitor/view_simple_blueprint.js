const BASE_URL = Cypress.env('OC_URL')
const REPOS_NAMESPACE = Cypress.env('REPOS_NAMESPACE')

describe('Visitor view simple blueprint overview', () => {
  beforeEach(() => {
    cy.visit(`${BASE_URL}/${REPOS_NAMESPACE}/simple-blueprint`)
  })

  it('Should not have a visible flash alert', () => {
    cy.wait(5000)
    cy.get('.flash-alert', {timeout: 0}).should('not.exist')
  })

  it('Has deploy buttons', () => {
    cy.contains('button', 'Deploy')

  })

})
