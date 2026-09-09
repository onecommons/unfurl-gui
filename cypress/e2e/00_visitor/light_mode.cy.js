/*
 * Light mode, which standalone renders when localStorage `oc-color-mode` is
 * 'light' -- see the pre-paint script in public/index.html and the toggle in
 * unfurl's header partial. The class lands on <html> before first paint, so
 * setting the key in onBeforeLoad is enough; no toggling after load.
 *
 * A subset rather than a mirror of the dark set. These four between them cover
 * cards, tables, form widgets and popovers, which is where a colour that only
 * resolves in dark shows itself. Doubling all 44 captures would double every
 * future baseline refresh for very little extra signal.
 *
 * The project overview is here deliberately: it is the densest app surface and
 * the one a fixture page does not stand in for.
 */

const DASHBOARD_DEST = Cypress.env('DASHBOARD_DEST')
const REPOS_NAMESPACE = Cypress.env('REPOS_NAMESPACE')
const SMOKE_PROJECT = Cypress.env('SMOKE_PROJECT') || (REPOS_NAMESPACE && `${REPOS_NAMESPACE}/minecraft`)

const DELIMITER = '/-'
const STANDALONE = !DASHBOARD_DEST || DASHBOARD_DEST.startsWith('/') || DASHBOARD_DEST.includes(':')
const DASHBOARD_BASE = STANDALONE ? '' : `/${DASHBOARD_DEST}`

const preferLight = win => win.localStorage.setItem('oc-color-mode', 'light')

// guards against the capture silently being a dark page, which is exactly the
// mistake this spec exists to catch
function assertLight() {
  cy.document().its('documentElement.className').should('contain', 'gl-light')
  cy.document().then(doc => {
    const bg = doc.defaultView.getComputedStyle(doc.body).backgroundColor
    const [r, g, b] = (bg.match(/[\d.]+/g) || []).map(Number)
    expect((r + g + b) / 3, `body background should be light, got ${bg}`).to.be.greaterThan(140)
  })
}

function lightShot(name, url, landmark, content) {
  it(`renders ${name} in light mode`, () => {
    cy.visit(url, {failOnStatusCode: false, onBeforeLoad: preferLight})
    cy.get(`[data-testid="${landmark}"]`, {timeout: Cypress.config('defaultCommandTimeout') * 2})
      .should('exist')
    // wait for content, not just the landmark -- without this the project
    // overview photographed an empty page, 577px against the dark set's 1639
    cy.get(content, {timeout: Cypress.config('defaultCommandTimeout') * 2})
      .should('be.visible')
    assertLight()
    cy.screenshotPage(`light/${name}`)
  })
}

describe('Light mode', () => {
  const ROW = '[data-testid$="-row"], tbody tr, .gl-card'

  lightShot('dashboard-home', DASHBOARD_BASE || '/', 'dashboard-home-page', ROW)
  lightShot('dashboard-environments', `${DASHBOARD_BASE}${DELIMITER}/environments`, 'dashboard-environments-page', ROW)

  if (SMOKE_PROJECT) {
    lightShot('project-home', `/${SMOKE_PROJECT}`, 'project-home-page', '[data-testid^="deploy-template-"]')
  } else {
    it.skip('needs REPOS_NAMESPACE or SMOKE_PROJECT for the project overview', () => {})
  }

  it('renders the formily widgets in light mode', () => {
    cy.visitBuiltPage('form-fixture.html', '', {onBeforeLoad: preferLight})
    cy.get('[data-testid="oc-inputs-form"]').should('exist')
    assertLight()
    cy.screenshotPage('light/form-fixture')
  })
})
