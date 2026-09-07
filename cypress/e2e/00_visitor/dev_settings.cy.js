/*
 * experimental-settings-indicator is the only component in the standalone
 * bundle that is disabled there: it reads gon.unfurl_gui at module scope, and
 * the oc barrel imports it eagerly, so the flag has to be set by the page.
 * That is why it gets its own fixture rather than a gallery entry.
 */
describe('developer settings', () => {
  it('renders the settings modal', () => {
    // the modal opens from the query string, which is its only trigger unless
    // a setting is already stored
    cy.visitBuiltPage('dev-settings.html', '?dev-settings')

    cy.get('[data-testid="experimental-settings-card"]', {timeout: 20000}).should('be.visible')
    cy.get('[data-testid="experimental-download-state"]').should('be.visible')
    cy.get('[data-testid="experimental-upload-state"]').should('be.visible')
    // every configurable option gets a row
    cy.get('[data-testid="experimental-settings-card"] input').should('have.length.greaterThan', 5)

    // a gl-modal is fixed-position, so screenshotStable would hide it
    cy.screenshotOverlay('.modal.show', 'dev-settings/modal')
  })
})
