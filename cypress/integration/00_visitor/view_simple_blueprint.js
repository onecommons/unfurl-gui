const BASE_URL = Cypress.env('OC_URL')

describe('Visitor view simple blueprint overview', () => {
  beforeEach(() => {
    cy.visit(`${BASE_URL}/testing/simple-blueprint`)
  })

  it('Should not have a visible flash alert', () => {
    cy.wait(5000)
    cy.get('.flash-alert', {timeout: 0}).should('not.exist')
  })

  it('Has deploy buttons', () => {
    cy.contains('button', 'Deploy')

  })

})
