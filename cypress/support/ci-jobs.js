const BASE_URL = Cypress.env('OC_URL')
const USER = Cypress.env('OC_IMPERSONATE')
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
  }, {timeout: 120000})
}

function expectSuccessfulJob(job) {
  withCompletedJob(job, job => {
    expect(job.status.text).to.equal('passed')
  })
}

function withJobFromURL(cb) {
  cy.url().then(url => {
    let result = url.split('/').pop()
    expect(result).to.match(/^[0-9]*$/)
    cb(result)
  })
}

function assertDeploymentRunning(deploymentTitle) {
  cy.visit(`${BASE_URL}/dashboard/deployments?show=running`)
  cy.contains('td', deploymentTitle).within(() => {
    //cy.get('[data-testid="status_success_solid-icon"]').should('exist')
    cy.get('[data-testid="status_success_solid-icon"]').should('exist')
    cy.get('[data-testid="status_success_solid-icon"]').scrollIntoView()
  })
}

Cypress.Commands.add('withCompletedJob', withCompletedJob)
Cypress.Commands.add('expectSuccessfulJob', expectSuccessfulJob)
Cypress.Commands.add('withJobFromURL', withJobFromURL)
Cypress.Commands.add('assertDeploymentRunning', assertDeploymentRunning)
