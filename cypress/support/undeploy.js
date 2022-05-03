const BASE_URL = Cypress.env('OC_URL')
function undeploy(deploymentTitle) {
  cy.visit(`${BASE_URL}/dashboard/deployments?show=running`)
  cy.contains('td', deploymentTitle).within(() => {
    //cy.get('[data-testid="status_success_solid-icon"]').should('exist')
    cy.get('[data-testid="status_success_solid-icon"]').should('exist')
    cy.get('[data-testid="status_success_solid-icon"]').scrollIntoView()
    
  })

  cy.contains('tr', deploymentTitle).within(() => {
    cy.get('button.dropdown-toggle').click()
    cy.contains('button', 'Teardown').click()
  })
  cy.contains('button', 'Confirm').click()
  cy.url({timeout: 20000}).should('not.include', 'dashboard/deployments')
  cy.withJobFromURL(job => {
    cy.expectSuccessfulJob(job)
    cy.withCompletedJob(job, () => {
      cy.visit(`${BASE_URL}/dashboard/deployments?show=undeployed`)
      cy.contains('td', deploymentTitle).should('exist')
    })
  })
}


Cypress.Commands.add('undeploy', undeploy)
