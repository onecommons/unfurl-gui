const REPOS_NAMESPACE = Cypress.env('REPOS_NAMESPACE')
const SIMPLE_BLUEPRINT = Cypress.env('SIMPLE_BLUEPRINT')

describe('Sanity check', () => {
  it('Can access a store', () => {
    cy.visit(`/${REPOS_NAMESPACE}/${SIMPLE_BLUEPRINT}`)
    cy.window().should('have.property', '$store')
  })

  it('Can set mock deploy', () => {
    cy.window().then(win => {
      win.sessionStorage['mock-deploy'] = 't'
      cy.reload()
      cy.window().then(win => {
        expect(win.$store.getters.UNFURL_MOCK_DEPLOY).to.be.true
      })
    })
  })

  it('Can set unfurl trace', () => {
    cy.window().then(win => {
      win.sessionStorage['unfurl-trace'] = 't'
      cy.reload()
      cy.window().then(win => {
        expect(win.$store.getters.UNFURL_TRACE).to.be.true
      })
    })
  })
})
