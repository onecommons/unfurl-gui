describe('oc_inputs fixture', () => {
  const pageErrors = []
  before(() => {
    Cypress.on('window:before:load', win => {
      win.addEventListener('error', e => pageErrors.push(e.message))
      const orig = win.console.error.bind(win.console)
      win.console.error = (...a) => { pageErrors.push(String(a[0])); orig(...a) }
    })
    Cypress.on('uncaught:exception', err => { pageErrors.push(err.message); return false })
  })

  it('renders every ComponentMap widget and round-trips a value', () => {
    cy.visit('/form-fixture.html')
    cy.get('[data-testid="oc-inputs-form"]', {timeout: 20000}).should('exist')

    const t = n => `[data-testid="oc-input-fixture-${n}"]`
    ;['text','textarea','number','checkbox','select','password','array','object'].forEach(n => {
      cy.get(t(n)).should('exist')
    })

    cy.getInputOrTextarea(t('text')).type('hello world')
    cy.wait(600)
    cy.window().then(win => {
      expect(win.$store.state.saved, 'updateProperty payload').to.have.property('text', 'hello world')
    })
    cy.screenshotPage('formily/fixture')
    cy.then(() => { cy.task('log', `[fixture] page errors: ${JSON.stringify(pageErrors.slice(0,8))}`) })
  })
})
