/*
 * Screenshots the components 2A.2 rewrites that no route the specs visit
 * renders: autostop, deployment-scheduler, github-auth, import-*,
 * experimental-settings-input and the two public_cloud controls.
 *
 * The page is src/pages/gallery -- see vue.config.js. Each component is
 * screenshotted on its own so a diff names the component that moved, and each
 * is wrapped in an error boundary so one throwing component does not cost the
 * other eight their screenshots.
 */

const ENTRIES = [
  'autostop',
  'autostop-inner',
  'deployment-scheduler',
  'github-auth',
  'import-button',
  'import-link',
  'experimental-settings-input',
  'cloud-table',
  'map-controls',
]

describe('component gallery', () => {
  const pageErrors = []

  before(() => {
    Cypress.on('window:before:load', win => {
      win.addEventListener('error', e => pageErrors.push(e.message))
    })
    Cypress.on('uncaught:exception', err => { pageErrors.push(err.message); return false })
    // autostop-inner derives its default date and time from Date.now() in
    // data(), so without this its two screenshots drift every run. Only Date
    // is stubbed -- stubbing timers as well breaks popper and Vue's nextTick.
    cy.clock(new Date('2026-03-04T10:20:00Z').getTime(), ['Date'])
    cy.visitBuiltPage('gallery.html')
    cy.get('[data-testid="gallery-map-controls"]', {timeout: 20000}).should('exist')
  })

  ENTRIES.forEach(name => {
    it(`renders ${name}`, () => {
      // a boundary that caught something renders the message instead of the
      // component, which is a failure worth naming rather than screenshotting
      cy.get(`[data-testid="gallery-${name}-error"]`).should('not.exist')
      cy.get(`[data-testid="gallery-${name}"]`).should('be.visible')
      cy.screenshotElement(`[data-testid="gallery-${name}"]`, `gallery/${name}`)
    })
  })

  it('shows the public cloud help tooltip', () => {
    cy.get('[data-testid="public-cloud-help"]').trigger('mouseenter')
    cy.get('.gl-tooltip').should('be.visible').and('contain.text', 'open-source')
    // a page shot, like the other tooltip captures: the tooltip sits above
    // its icon and an element shot of the entry clips it
    cy.screenshotPage('gallery/cloud-table-tooltip')
    cy.get('[data-testid="public-cloud-help"]').trigger('mouseleave')
  })

  it('opens the autostop popover', () => {
    // The popover only exists once clicked, so no static shot covers it. It is
    // appended to <body> and positioned by popper, so a page shot catches it
    // mid-reposition when the fullPage capture resizes the viewport -- and it
    // lands on top of the entries below it either way. Shoot the panel itself.
    cy.get('[data-testid="gallery-autostop"] button').first().click()
    // clicking leaves the trigger's own tooltip up, covering the panel
    cy.get('[data-testid="gallery-autostop"] button').first().trigger('mouseleave')
    cy.get('.gl-tooltip, .el-tooltip__popper').should('not.be.visible')
    // the panel is appended to <body>; autostop.vue's data-testid lands on the
    // trigger, not on it. 2A.2 must repoint this when el-popover goes.
    cy.get('.el-popover').should('be.visible')
    cy.screenshotElement('.el-popover', 'gallery/autostop-popover')
  })

  after(() => {
    cy.then(() => { cy.task('log', `[gallery] page errors: ${JSON.stringify(pageErrors.slice(0, 8))}`) })
  })
})
