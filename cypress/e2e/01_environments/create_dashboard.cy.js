const USERNAME = Cypress.env('OC_IMPERSONATE')

describe('Create Dashboard', () => {
  before(() => cy.requireProjectCreation())

  it('Can create a new dashboard project', () => {
    // Fixed path, not a random one: OC::UNFURL_DASHBOARD_NAME is 'dashboard'
    // and oc-pages resolves a user's dashboard by that convention rather than
    // by id, so a suffixed project is invisible to it. Each run creates a
    // fresh user, so there is nothing to disambiguate anyway.
    const dashboardName = 'dashboard'

    // Reached by URL rather than through the sidebar. 19.3 dropped the
    // menu-item hook this used to click, and its new-project page has no hook
    // on the title either -- there is nothing stable to click on the way in,
    // and the route is the part that is not going to be redesigned.
    cy.visit('/projects/new')

    // Addressed by panel name, not by title. 15.11 retitled this stock panel
    // "Create an Unfurl project"; 19.3 shows upstream's "Create from
    // template". Same panel, same templates behind it -- the name is what is
    // stable across both. Rendered twice, hence .first().
    cy.get('[data-qa-panel-name="create_from_template"]').first().click()

    // Scoped to the pane throughout: every pane renders its own copy of the
    // project form, and the username also appears in the sidebar's user menu,
    // so an unscoped match lands on the wrong element.
    cy.get('#create-from-template-pane').within(() => {
      cy.get('[data-testid="use_template_unfurl_dashboard"]').click()
      cy.get('[data-testid="project-name"]').type(dashboardName)

      // 19.3 makes the namespace an explicit choice; 15.11 defaulted to the
      // user's own, which is why the old spec never touched it.
      cy.get('[data-testid="select-namespace-dropdown"]').click()
      cy.get('[data-testid="base-dropdown-menu"]').contains(USERNAME).click()

      cy.get('[data-testid="project-create-button"]').click()
    })

    // Creation lands on the project root, which is where the dashboard's home
    // route ('/') and its welcome card live -- '$DELIMITER/deployments' maps to
    // DeploymentsIndex, which does not carry the card. Wait for the landing
    // rather than navigating to it: cy.visit does not retry and would race it.
    cy.location('pathname', {timeout: 30000}).should('eq', `/${USERNAME}/${dashboardName}`)

    // Matched without the apostrophe: a project at the canonical
    // <user>/dashboard gets the short form of this message, with a curly
    // U+2019, while a differently-named one gets "...to <path> yet" with a
    // straight quote.
    cy.contains('deployed anything yet', {timeout: 30000}).should('exist')
  })
})
