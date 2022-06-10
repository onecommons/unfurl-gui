const BASE_URL = Cypress.env('OC_URL')
const USER = Cypress.env('OC_IMPERSONATE')
const BASE_TIMEOUT = Cypress.env('BASE_TIMEOUT')
function jobToJSONEndpoint(job) {
  return `${BASE_URL}/${USER}/dashboard/-/jobs/${job}.json`
}

function withCompletedJob(job, cb) {
  let status
  let running = true
  // cypress gets mad when this isn't an async function
  cy.waitUntil(async () => {
    cy.wait(1000)
    cy.request(jobToJSONEndpoint(job)).then(response => {
      if(running && response.body.complete) {
        running = false
        cb(response.body)
      }
    })
    return !running
  }, {timeout: BASE_TIMEOUT * 20})
}

function expectSuccessfulJob(job) {
  withCompletedJob(job, job => {
    expect(job.status.text).to.equal('passed')
  })
}

function withJob(cb) {
  cy.wait(BASE_TIMEOUT * 2)
  return cy.withStore().then(async (store) => {
    const environment = store.getters.getCurrentEnvironment
    const deployment = store.getters.getDeploymentTemplate
    const deploymentItem = store.getters.deploymentItemDirect({deployment, environment})
    const result = deploymentItem && deploymentItem.job && deploymentItem.job.id
    cb && cb(result)
    return result
  })
}

function assertDeploymentRunning(deploymentTitle) {
  //cy.visit(`${BASE_URL}/dashboard/deployments?show=running`)
  cy.contains('td', deploymentTitle).within(() => {
    //cy.get('[data-testid="status_success_solid-icon"]').should('exist')
    cy.get('[data-testid="status_success_solid-icon"]').should('exist')
    cy.get('[data-testid="status_success_solid-icon"]').scrollIntoView()
  })
}

Cypress.Commands.add('withCompletedJob', withCompletedJob)
Cypress.Commands.add('expectSuccessfulJob', expectSuccessfulJob)
Cypress.Commands.add('withJob', withJob)
Cypress.Commands.add('assertDeploymentRunning', assertDeploymentRunning)
