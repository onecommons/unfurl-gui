/**
 * The mobile layout at <=768px, the breakpoint misc.ts shares with GitLab.
 *
 * Its getter read the module's state function rather than the state, so every
 * isMobileLayout branch was dead until 7462aa73. The environment page is where
 * the layout is visible without a deployment: its "Add External Resource"
 * button moves from the card's header to its footer.
 */
const DASHBOARD_DEST = Cypress.env('DASHBOARD_DEST')
const STANDALONE = !DASHBOARD_DEST || DASHBOARD_DEST.startsWith('/') || DASHBOARD_DEST.includes(':')
const base = STANDALONE ? '' : `/${DASHBOARD_DEST}`
const HEIGHT = 1000

let environmentPath

const ADD = 'button:visible:contains("Add External Resource")'

// one selector per query: the card re-renders, and a chained .closest()
// cannot requery a detached subject
function expectLayout(mobile) {
  cy.withStore().its('getters.isMobileLayout').should('equal', mobile)
  cy.get(ADD).should('have.length', 1)
  cy.get(`${mobile ? '.gl-card-footer' : '.gl-card-header'} ${ADD}`).should('have.length', 1)
}

describe('Mobile layout', () => {
  before(() => {
    cy.visit(`${base}/-/environments`)
    cy.withStore().then(store => {
      const environments = store.getters.getEnvironments || []
      expect(environments, 'environments in the dashboard').not.to.be.empty
      environmentPath = `${base}/-/environments/${environments[0].name}`
    })
  })

  function visitEnvironment(width) {
    cy.viewport(width, HEIGHT)
    cy.visit(environmentPath)
    cy.get('[data-testid="dashboard-environment-page"]').should('exist')
  }

  it('lays out a narrow window for mobile', () => {
    visitEnvironment(700)
    expectLayout(true)
  })

  it('lays out a wide window for desktop', () => {
    visitEnvironment(1280)
    expectLayout(false)
  })

  it('follows the window across the breakpoint', () => {
    visitEnvironment(1280)
    expectLayout(false)
    cy.viewport(768, HEIGHT)
    expectLayout(true)
    cy.viewport(769, HEIGHT)
    expectLayout(false)
  })
})
