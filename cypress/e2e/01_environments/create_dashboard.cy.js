const USERNAME = Cypress.env('OC_IMPERSONATE')

describe('Create Dashboard', () => {
  it('Can create a new dashboard project', () => {
    const dashboardName = `dashboard${btoa(Math.random()).slice(0,4).toLowerCase()}`
    // stop forcing this when developer settings indicator is sitting in a more sensible place?
    cy.get('[data-testid="hamburger-icon"]').first().click({force: true})
    cy.contains('[data-testid="menu-item"]', 'Projects').click()
    cy.get('[data-qa-title="Create new project"]').click()

    cy.contains('[data-qa-selector="panel_link"]', 'Create an Unfurl project').click()

    cy.get('[data-testid="use_template_unfurl_dashboard"]').click()

    cy.get('#project_name[data-qa-selector="project_name"]').first().type(dashboardName)

    cy.contains('Create project').click()

    cy.contains(`You haven't deployed anything to ${USERNAME}/${dashboardName} yet`).should('exist')
  })
})
