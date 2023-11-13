import {deploymentFixturePath} from '../../support/deployment-fixture'
const NAMESPACE = Cypress.env('DEFAULT_NAMESPACE')
const BASE_TIMEOUT = Cypress.env('BASE_TIMEOUT')
const fixture = deploymentFixturePath('az__nextcloud__sh')

function deploymentName(baseTitle) {
  return `Cy ${baseTitle} ${Date.now().toString(36).slice(4) + Math.random().toString().slice(-4)}`
}

function shouldDeploy(deploymentTemplateTitle) {
  // copied from should deploy with alterations
  cy.get('[data-testid="deploy-button"]:not([disabled])').click()
  cy.whenUnfurlGUI(() => {
    cy.url({timeout: BASE_TIMEOUT * 10}).should('not.include', 'deployment-drafts')
    cy.wait(BASE_TIMEOUT)
    // TODO figure out how to chain this?
    cy.withStore((store) => {
      expect(store.getters.getDeployment.status).to.equal(1)
    })

  })
  cy.whenGitlab(() => {
    // cy.url({timeout: BASE_TIMEOUT * 10}).should('include', deploymentTemplateTitle)
    cy.wait(BASE_TIMEOUT)
    cy.withJob((job) => {
      cy.expectSuccessfulJob(job)
    })
    cy.assertDeploymentRunning(deploymentTemplateTitle)

    // TODO make this info available
    // cy.verifyDeployment({deployment, env, dnsZone, sub: subdomain, expectExisting, verificationRoutine}, options.verificationArgs || {})

    cy.undeploy(deploymentTemplateTitle)
  })
}

function editAndDeploy(title) {
  cy.visit(`/${NAMESPACE}/dashboard/-/deployments?show=drafts`)

  cy.contains('tr', title).should('exist')

  cy.contains('tr', title).within(() => {
    cy.contains('a', 'Edit Draft').click()
  })

  shouldDeploy(title)
}

function cloneDeployment(ogTitle, cloneTitle) {
  cy.visit(`/${NAMESPACE}/dashboard/-/deployments?show=drafts`)

  cy.contains('tr', ogTitle).within(() => {
    cy.get('button.dropdown-toggle').click()
    cy.contains('button', 'Clone Deployment').click()
  })

  cy.get('.modal-body input').clear().type(cloneTitle)
  cy.contains('button', 'Confirm').click()

  cy.url().should('contain', `/${NAMESPACE}/dashboard/-/deployments/`)
}

describe('Cloning and deploying drafts', () => {
  it('Can clone and deploy drafts for nextcloud', () => {

    const ogTitle = deploymentName('Clone test original')
    const cloneTitle = deploymentName('Clone test')

    cy.recreateDeployment({
      title: ogTitle,
      fixture,
      shouldSave: true
    })

    cloneDeployment(ogTitle, cloneTitle)

    editAndDeploy(cloneTitle)
  })

  it('Can deploy and then clone', () => {

    const ogTitle = deploymentName('Clone test original')
    const cloneTitle = deploymentName('Clone test')

    cy.recreateDeployment({
      title: ogTitle,
      fixture,
      verificationRoutine: 'skip'
    })

    cloneDeployment(ogTitle, cloneTitle)

    editAndDeploy(cloneTitle)
  })

})
