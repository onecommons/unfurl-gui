import {dashboardPath} from './dashboard-path'
const USER = Cypress.env('OC_IMPERSONATE')
const DASHBOARD_DEST = Cypress.env('DASHBOARD_DEST')
const BASE_TIMEOUT = Cypress.env('BASE_TIMEOUT')
function jobToJSONEndpoint(job) {
  return dashboardPath(`/-/jobs/${job}.json`)
}

function withCompletedJob(job, cb) {
  let status
  let running = true
  // cypress gets mad when this isn't an async function
  cy.waitUntil(async () => {
    // we'll use less memory on snapshots if we don't poll so frequently
    cy.wait(BASE_TIMEOUT / 2)
    cy.request(jobToJSONEndpoint(job)).then(response => {
      if(running && response.body.complete) {
        running = false
        cb(response.body)
      }
    })
    cy.window().then(win => {
      typeof win.gc == 'function' && win.gc()
    })
    return !running
  }, {timeout: BASE_TIMEOUT * 60}) // should be about 10 minutes
}

function expectSuccessfulJob(job) {
  withCompletedJob(job, job => {
    // 19.x humanizes status.text ("Passed"), 15.11 does not. Not status.label:
    // Build::Play overrides it to "manual play action" for any playable build,
    // and a job that succeeded is still retryable, so still playable.
    expect(job.status.text?.toLowerCase(), `job ${job.id} status`).to.equal('passed')
  })
}

// A deployment only gets a job id once GitLab has actually created the
// pipeline. When POST /-/deployments/new fails -- a 400 from an empty
// pipeline, say -- that never happens, so this has to give up rather than
// recurse forever: unbounded, the spec hangs silently to the run's timeout
// with no failure to read.
// each attempt waits BASE_TIMEOUT * 2; a healthy deploy has a job id well
// inside the first few
const WITH_JOB_ATTEMPTS = 10

function withJob(cb, attempt = 1) {
  cy.wait(BASE_TIMEOUT * 2)
  return cy.withStore().then(async (store) => {
    const environment = store.getters.getCurrentEnvironment
    const deployment = store.getters.getDeploymentTemplate
    const deploymentItem = store.getters.deploymentItemDirect({deployment, environment})
    const result = deploymentItem && deploymentItem.job && deploymentItem.job.id
    if(!result) {
      if(attempt >= WITH_JOB_ATTEMPTS) {
        throw new Error(
          `withJob: no job id after ${attempt} attempts -- the deployment never got a pipeline. ` +
          'Check that POST /-/deployments/new succeeded.'
        )
      }
      return withJob(cb, attempt + 1)
    }
    cb && cb(result)
    return result
  })
}

// The page is rendered against whatever commit GitLab knew when it served it,
// and the deploy job's own push lands in the same second the job reports
// complete. Retrying the DOM query cannot see that push -- the app does not
// refetch -- so reload instead of just waiting.
const RUNNING_RELOAD_ATTEMPTS = 6

function assertDeploymentRunning(deploymentTitle, attempt = 1) {
  cy.visit(dashboardPath(`/-/deployments?show=running`))
  // this becomes slow after a deployment completes on large dashboards
  cy.get('[data-testid="dashboard-deployments-page"]', {timeout: BASE_TIMEOUT * 2})
  cy.document().then(doc => {
    const present = Array.from(doc.querySelectorAll('td'))
      .some(td => td.textContent.includes(deploymentTitle))

    if(!present) {
      if(attempt >= RUNNING_RELOAD_ATTEMPTS) {
        throw new Error(
          `assertDeploymentRunning: "${deploymentTitle}" never reached the running tab after ` +
          `${attempt} loads -- the deploy recorded no status, or the page is still on a pre-deploy commit.`
        )
      }
      cy.wait(BASE_TIMEOUT)
      return assertDeploymentRunning(deploymentTitle, attempt + 1)
    }

    cy.contains('td', deploymentTitle).within(() => {
      cy.get('[data-testid="status_success_solid-icon"]').should('exist')
      cy.get('[data-testid="status_success_solid-icon"]').scrollIntoView()
    })
  })
}

Cypress.Commands.add('withCompletedJob', withCompletedJob)
Cypress.Commands.add('expectSuccessfulJob', expectSuccessfulJob)
Cypress.Commands.add('withJob', withJob)
Cypress.Commands.add('assertDeploymentRunning', assertDeploymentRunning)
