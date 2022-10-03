const BASE_URL = Cypress.env('OC_URL')
const USERNAME = Cypress.env('OC_IMPERSONATE')
import slugify from '../../packages/oc-pages/vue_shared/slugify'
function undeploy(deploymentTitle) {
  cy.assertDeploymentRunning(deploymentTitle)
  cy.contains('tr', deploymentTitle).within(() => {
    cy.get('button.dropdown-toggle').click()
    cy.contains('button', 'Teardown').click()
  })
  cy.contains('button', 'Confirm').click()
  cy.url({timeout: 20000}).should('include', slugify(deploymentTitle))
  cy.withJob(job => {
    cy.expectSuccessfulJob(job)
    cy.withCompletedJob(job, () => {
      cy.visit(`${BASE_URL}/${USERNAME}/dashboard/-/deployments?show=destroyed`)
      cy.contains('td', deploymentTitle).should('exist')
    })
  })
}


Cypress.Commands.add('undeploy', undeploy)
