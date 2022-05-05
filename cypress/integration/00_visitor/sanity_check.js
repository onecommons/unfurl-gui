const BASE_URL = Cypress.env('OC_URL')
const REPOS_NAMESPACE = Cypress.env('REPOS_NAMESPACE')
const SIMPLE_BLUEPRINT = Cypress.env('SIMPLE_BLUEPRINT')

describe('Sanity check', () => {
  it('Can access a store', () => {
    cy.visit(`${BASE_URL}/${REPOS_NAMESPACE}/${SIMPLE_BLUEPRINT}`)
    cy.window().should('have.property', '$store')
  })
})
