const REPOS_NAMESPACE = Cypress.env('REPOS_NAMESPACE')
const SIMPLE_BLUEPRINT = Cypress.env('SIMPLE_BLUEPRINT')

describe('Visitor view simple blueprint overview', () => {
  beforeEach(() => {
    cy.visit(`/${REPOS_NAMESPACE}/${SIMPLE_BLUEPRINT}`)
  })

  it('Should not have a visible flash alert', () => {
    cy.wait(5000)
    cy.get('.flash-alert', {timeout: 0}).should('not.exist')
  })

  it('Has deploy buttons', () => {
    cy.contains('button', 'Deploy')

  })

})
