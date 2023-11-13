import {deploymentFixturePath} from '../../support/deployment-fixture'
import slugify from '../../../packages/oc-pages/vue_shared/slugify'
const FIXTURE = deploymentFixturePath('gcp__memos__memos')
const USERNAME = Cypress.env('OC_IMPERSONATE')
const BASE_TIMEOUT = Cypress.env('BASE_TIMEOUT')
const GCP_DNS_ZONE = Cypress.env('GCP_DNS_ZONE')
const INTEGRATION_TEST_ARGS = Cypress.env('INTEGRATION_TEST_ARGS')
const NAMESPACE = Cypress.env('DEFAULT_NAMESPACE')

describe('Shared dashboard test', () => {
  const baseTitle = 'shared-dashbaord-env'
  const baseDeploymentTitle = 'Shared dashboard deployment'
  const suffix = Date.now().toString(36).slice(4) + Math.random().toString().slice(-4)
  const environmentName = `${baseTitle}-gcp${suffix}`.toLowerCase()
  const deploymentTitle = `${baseDeploymentTitle} ${suffix}`

  afterEach(() => {
    // local storage caching allows this test to pass when it shouldn't
    cy.clearLocalStorage()
    // flash messages that don't make sense
    // cy.clearAllSessionStorage() // doesn't work


    cy.window().then(win => {
      win.sessionStorage.clear()
    })

  })

  it('Can create an environment with the owner', () => {
    cy.createGCPEnvironment({
      environmentName,
      shouldCreateExternalResource: true,
      shouldCreateDNS: true
    })
  })

  it('Can create a draft from another user', () => {
    const usernameA = `shared-dashboard-user-${suffix}A`
    const usernameB = `shared-dashboard-user-${suffix}B`
    if(INTEGRATION_TEST_ARGS.dashboardRepo) {
      cy.execLoud(`yarn create-user --username ${usernameA} --dashboard ${INTEGRATION_TEST_ARGS.dashboardRepo}`)
      cy.execLoud(`yarn create-user --username ${usernameB} --dashboard ${INTEGRATION_TEST_ARGS.dashboardRepo}`)
    } else {
      cy.execLoud(`yarn create-user --username ${usernameA}`)
      cy.execLoud(`yarn create-user --username ${usernameB}`)
    }
    cy.execLoud(`./scripts/src/add-project-member.js --username ${usernameB} --project ${USERNAME}/dashboard --accessLevel 30`)
    cy.execLoud(`./scripts/src/add-project-member.js --username ${usernameB} --project ${usernameA}/dashboard --accessLevel 30`)

    // usernameB is now a member of multiple other users' dashboards

    cy.logout()
    cy.login(Cypress.env('OC_USERNAME'), Cypress.env('OC_PASSWORD'), usernameB)
    cy.recreateDeployment({
      fixture: 'generated/deployments/_production-gcp__nextcloud__mail-and-pg.json',
      env: environmentName,
      title: deploymentTitle,
      shouldSave: true,
    })

  })

  it('Can deploy the draft', () => {
    Cypress.Cookies.debug(true)

    // cy.logout()    // gitlab is a piece of work
    // cy.clearCookies() // doesn't work?
    // cy.clearAllCookies() // not until cypress 12

    cy.getCookies().then(cookies => {
      cookies.forEach(cookie => cy.clearCookie(cookie.name, {domain: cookie.domain}))
    })

    cy.getCookies().should('be.empty') // doesn't work?
    cy.visit('/users/sign_in')

    cy.login(Cypress.env('OC_USERNAME'), Cypress.env('OC_PASSWORD'), USERNAME)
    cy.contains('Merge Request').click()
    cy.contains('[Draft]').click()
    cy.get('[data-testid="removeWipButton"]').click()
    cy.wait(BASE_TIMEOUT / 2)
    cy.get('[data-testid="merge-button"]').click()
    cy.contains('[data-qa-selector="mr_widget_content"]', 'Merged').should('exist')
    cy.wait(BASE_TIMEOUT) // this is stupidly slow for some reason
    cy.get('[data-qa-selector="description_content"]').within(() => {
      cy.contains('a', slugify(deploymentTitle)).click()
    })
    cy.wait(BASE_TIMEOUT / 2)
    cy.get('[data-testid="deploy-button"]').should('be.disabled')
    cy.get('[data-testid="tab-inputs-self-hosted-postgresdb"]').click()
    cy.contains('button', 'Generate').click()

    cy.wait(BASE_TIMEOUT / 2)

    cy.get('[data-testid="deploy-button"]').click()
    cy.wait(BASE_TIMEOUT / 2)

    cy.contains('a', 'Console').should('exist')

    cy.withJob((job) => {
      cy.expectSuccessfulJob(job)
    })

    cy.undeploy(deploymentTitle, {verify: false})
  })

})

