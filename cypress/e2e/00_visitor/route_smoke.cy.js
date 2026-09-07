/*
 * Visits every route in dashboard/router/routes.js and
 * project_overview/router/routes.js plus the public_cloud page, asserts the
 * route's landmark testid renders, and screenshots it.
 *
 * This is the migration baseline: it covers the dashboard pages the blueprint
 * specs skip, and it is the first thing that breaks when a gl-* component
 * changes shape. Keep it free of component-library selectors.
 *
 * Blocking failures are uncaught exceptions and window errors. console.error
 * is counted and logged but does not fail the run — the app emits some today,
 * and a spec that is red on day one never becomes a baseline.
 */

const DASHBOARD_DEST = Cypress.env('DASHBOARD_DEST')
const REPOS_NAMESPACE = Cypress.env('REPOS_NAMESPACE')
const SMOKE_PROJECT = Cypress.env('SMOKE_PROJECT') || (REPOS_NAMESPACE && `${REPOS_NAMESPACE}/minecraft`)

// $DELIMITER in dashboard/router/routes.js is substituted in router/index.js
const DELIMITER = '/-'

// Standalone serves the dashboard at the root and DASHBOARD_DEST is a
// filesystem path for the server, not a URL segment. The fork mounts it under
// the dashboard project's path.
const STANDALONE = !DASHBOARD_DEST || DASHBOARD_DEST.startsWith('/') || DASHBOARD_DEST.includes(':')
const DASHBOARD_BASE = STANDALONE ? '' : `/${DASHBOARD_DEST}`

const pageErrors = []

function collectErrors() {
  Cypress.on('window:before:load', win => {
    win.addEventListener('error', e => {
      pageErrors.push(`[windowerror] ${e.message} at ${e.filename}:${e.lineno}`)
    })
    win.addEventListener('unhandledrejection', e => {
      const r = e.reason
      pageErrors.push(`[unhandledrejection] ${r instanceof Error ? r.message : String(r)}`)
    })
    const origError = win.console.error.bind(win.console)
    win.console.error = (...args) => {
      consoleErrors.push(String(args[0]))
      origError(...args)
    }
  })
  Cypress.on('uncaught:exception', err => {
    // cypress's own runner throws this from ProxyLogging.logIncomingRequest
    // while decoding a websocket message; e2e.js swallows it for the same
    // reason. It is not an application error.
    if (!(err.stack || '').includes('ProxyLogging.logIncomingRequest')) {
      pageErrors.push(`[uncaught] ${err.message}`)
    }
    return false
  })
}

const consoleErrors = []

/* Visit a route, wait for content to render, screenshot it, and assert the page
 * raised no blocking error while it rendered.
 *
 * `content` must be an element that only exists once the page has its data --
 * not the page's outermost div. Asserting the wrapper passes the instant the
 * component mounts, which screenshots a blank page and detects nothing.
 */
function smoke(name, url, landmark, content) {
  it(`renders ${name}`, () => {
    pageErrors.length = 0
    consoleErrors.length = 0

    cy.visit(url, {failOnStatusCode: false})
    cy.get(`[data-testid="${landmark}"]`, {timeout: Cypress.config('defaultCommandTimeout') * 2})
      .should('exist')
    cy.get(content, {timeout: Cypress.config('defaultCommandTimeout') * 2})
      .should('be.visible')

    cy.screenshotPage(`route-smoke/${name}`)

    cy.then(() => {
      if (consoleErrors.length) {
        cy.task('log', `[route-smoke] ${name}: ${consoleErrors.length} console.error(s): ${JSON.stringify(consoleErrors.slice(0, 5))}`)
      }
      expect(pageErrors, `page errors on ${name}`).to.deep.equal([])
    })
  })
}

describe('Route smoke', () => {
  before(collectErrors)

  describe('dashboard', () => {
    const base = DASHBOARD_BASE

    // set by table.vue / table_list_row.vue on rendered data rows only
    const ROW = '.oc-table-row'

    smoke('dashboard-home', base || '/', 'dashboard-home-page', ROW)
    smoke('dashboard-deployments-index', `${base}${DELIMITER}/deployments`, 'dashboard-deployments-page', ROW)
    smoke('dashboard-environments-index', `${base}${DELIMITER}/environments`, 'dashboard-environments-page', ROW)

    // Parameterized routes need real names. Derive them from the store rather
    // than hardcoding, and skip when the fixture project has none yet.
    it('renders dashboard-environment and dashboard-deployment', function () {
      cy.visit(`${base}${DELIMITER}/environments`)
      cy.withStore().then(store => {
        const environments = store.getters.getEnvironments || []
        // each entry carries _environment, assigned on fetch in the
        // environments store
        const deployments = store.getters.getDeployments || []

        if (!environments.length) {
          cy.task('log', '[route-smoke] no environments in fixture project; skipping parameterized routes')
          return
        }

        const environmentName = environments[0].name
        pageErrors.length = 0
        cy.visit(`${base}${DELIMITER}/environments/${environmentName}`)
        cy.get('[data-testid="dashboard-environment-page"]').should('exist')
        cy.contains('Environment Name').should('be.visible')
        // oc_card builds its body lazily, so screenshotting on the page
        // landmark alone catches the external resource card mid-render.
        // Guarded, because an environment need not have external resources --
        // and specs that ran before this one can leave it without any.
        cy.get('body').then($body => {
          if ($body.find('[data-testid^="card-"]').length) {
            cy.get('[data-testid="oc-inputs-form"]', {timeout: 10000}).should('be.visible')
          }
        })
        cy.screenshotPage('route-smoke/dashboard-environment')
        cy.then(() => expect(pageErrors, 'page errors on dashboard-environment').to.deep.equal([]))

        // Tooltips only exist on hover, so no screenshot covers them. 2A.2
        // moves ~12 of them from el-tooltip to v-gl-tooltip; without this the
        // gate would report every one of those conversions as a no-op.
        // the external-resources help is a gl-popover, not a tooltip: two
        // paragraphs. Like a tooltip it exists only once provoked.
        cy.get('body').then($body => {
          if (!$body.find('[data-testid="external-resources-help"]').length) return
          cy.get('[data-testid="external-resources-help"]').trigger('mouseenter')
          cy.get('.popover').should('be.visible').and('contain.text', 'third-party resources')
          cy.screenshotPage('route-smoke/popover-external-resources')
          cy.get('[data-testid="external-resources-help"]').trigger('mouseleave')
          cy.get('.popover').should('not.exist')
        })

        cy.get('body').then($body => {
          if (!$body.find('[data-testid="card-validation-icon"]').length) return
          cy.get('[data-testid="card-validation-icon"]').first().trigger('mouseenter')
          cy.get('.gl-tooltip', {timeout: 4000})
            .should('be.visible')
            .invoke('text')
            .should('match', /Complete|Incomplete/)
          // and capture how it looks, not just that it exists
          cy.screenshotPage('route-smoke/tooltip-card-validation')
          cy.get('[data-testid="card-validation-icon"]').first().trigger('mouseleave')
        })

        // A gl-modal is fixed-position, and screenshotStable hides fixed
        // elements so a full-page shot does not repeat the sticky nav -- which
        // meant every modal in the app was unphotographable until
        // screenshotOverlay.
        cy.get('[data-testid="add-provider"]').click()
        cy.get('.modal.show').should('be.visible')
        cy.screenshotOverlay('.modal.show', 'route-smoke/modal-add-provider')
        cy.get('.modal.show .modal-header .close, .modal.show [aria-label="Close"]')
          .first().click({force: true})
        cy.get('.modal.show').should('not.exist')

        const deployment = deployments[0]
        if (!deployment) {
          cy.task('log', '[route-smoke] no deployments in fixture project; skipping deployment route')
          return
        }

        pageErrors.length = 0
        cy.visit(`${base}${DELIMITER}/deployments/${deployment._environment || environmentName}/${deployment.name}`)
        cy.get('[data-testid="dashboard-deployment-page"]').should('exist')
        cy.get('.oc-table-row').should('be.visible')
        cy.screenshotPage('route-smoke/dashboard-deployment')
        cy.then(() => expect(pageErrors, 'page errors on dashboard-deployment').to.deep.equal([]))
      })
    })
  })

  describe('project overview', () => {
    if (!SMOKE_PROJECT) {
      it.skip('needs REPOS_NAMESPACE or SMOKE_PROJECT to locate a blueprint project', () => {})
      return
    }

    // the blueprint's deploy buttons: absent until the project data loads
    smoke('project-home', `/${SMOKE_PROJECT}`, 'project-home-page', '[data-testid^="deploy-template-"]')
  })

  // The chart needs cloudmap data, which a bare `unfurl init` fixture project
  // does not have — 00_visitor/visit_cloudchart.cy.js fails standalone for the
  // same reason. Opt in where the cloudmap is configured.
  describe('public cloud', () => {
    if (!Cypress.env('UNFURL_CLOUDMAP_PATH')) {
      it.skip('needs UNFURL_CLOUDMAP_PATH to render the cloud chart', () => {})
      return
    }

    it('renders the cloud chart', () => {
      pageErrors.length = 0
      cy.visit('/cloud')
      cy.get('#chart svg').should('be.visible')
      cy.screenshotPage('route-smoke/public-cloud')
      cy.then(() => expect(pageErrors, 'page errors on public-cloud').to.deep.equal([]))
    })
  })
})
