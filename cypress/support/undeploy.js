const USERNAME = Cypress.env('OC_IMPERSONATE')
const NAMESPACE = Cypress.env('DEFAULT_NAMESPACE')
import slugify from '../../packages/oc-pages/vue_shared/slugify'
function undeploy(deploymentTitle, _options) {
  const {verify} = Object.assign({
    verify: true
  }, _options)

  cy.assertDeploymentRunning(deploymentTitle)
  cy.contains('tr', deploymentTitle).within(() => {
    cy.get('button.dropdown-toggle').click()
    cy.contains('button', 'Teardown').click()
  })
  cy.contains('button', 'Confirm').click()
  cy.url({timeout: 20000}).should('include', slugify(deploymentTitle))

  if(verify) {
    cy.withJob(job => {
      cy.expectSuccessfulJob(job)
      cy.withCompletedJob(job, () => {
        cy.visit(`/${NAMESPACE}/dashboard/-/deployments?show=destroyed`)
        cy.contains('td', deploymentTitle).should('exist')
      })
    })
  }
}


Cypress.Commands.add('undeploy', undeploy)
