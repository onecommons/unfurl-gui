import {deploymentFixturePath} from '../../support/deployment-fixture'

const DASHBOARD_DEST = Cypress.env('DASHBOARD_DEST')
const BASE_TIMEOUT = Cypress.env('BASE_TIMEOUT')
const fixture = deploymentFixturePath('aws__minecraft__minecraft')

function deploymentName(baseTitle) {
  return `Cy ${baseTitle} ${Date.now().toString(36).slice(4) + Math.random().toString().slice(-4)}`
}

/*
 * Rename and Delete on the deployments table. Both were uncovered: the row
 * dropdown is opened by other specs, but only for Teardown and Clone, and
 * neither of those takes the branches these do.
 *
 * A saved draft is enough for both -- isRenamable does not consult the
 * pipeline, and delete is gated on there being no cancelable job -- so nothing
 * here deploys.
 */
describe('Deployments table actions', () => {
  // The modal's primary reads 'Confirm', or 'Delete Anyway' when deleting
  // something it wants to warn about; address it by class rather than text.
  const confirmModal = () => cy.get('button.js-modal-action-primary:visible').click()

  // Not `button.dropdown-toggle`. GlDropdown still exists and still renders
  // that class -- several oc-pages components use it -- but these controls
  // stopped being one in 2a42534e, which moved them to GlDisclosureDropdown to
  // fix menu positioning. Its menu is positioned `fixed` and so is not inside
  // the row; only the toggle is addressed within it.
  const openRowMenu = title => {
    cy.contains('tr', title).within(() => {
      cy.get('.gl-new-dropdown-toggle').click()
    })
    cy.get('.gl-new-dropdown-panel:visible').should('exist')
  }

  const clickMenuItem = label => cy.get('.gl-new-dropdown-panel:visible')
    .contains('.gl-new-dropdown-item', label).click()

  const visitDrafts = () => cy.visit(`/${DASHBOARD_DEST}/-/deployments?show=drafts`)

  it('renames a deployment', () => {
    const title = deploymentName('Rename test before')
    // deliberately not derived from `title`: a new title containing the old one
    // makes the disappearance assertion below unsatisfiable
    const renamed = deploymentName('Rename test after')

    cy.recreateDeployment({title, fixture, shouldSave: true})

    visitDrafts()
    cy.contains('tr', title).should('exist')

    openRowMenu(title)
    clickMenuItem('Rename Deployment')

    cy.get('.modal-body input').clear().type(renamed)
    confirmModal()

    // In place, before navigating anywhere: renameDeployment commits the patch
    // but never writes the new title into the table's own state, so this is
    // what the page does to catch up. Asserting only after a re-visit would
    // pass whether or not it does.
    cy.contains('tr', renamed, {timeout: BASE_TIMEOUT * 2}).should('exist')

    // and again from the server, so this covers the write as well as the redraw
    visitDrafts()
    cy.contains('tr', renamed, {timeout: BASE_TIMEOUT * 2}).should('exist')
    cy.contains('tr', title).should('not.exist')
  })

  it('deletes a deployment from the index', () => {
    const title = deploymentName('Delete test')

    cy.recreateDeployment({title, fixture, shouldSave: true})

    // From the index rather than a deployment's own page: that is the branch
    // handleDeleteRedirect takes when it has nowhere to navigate to.
    visitDrafts()
    cy.contains('tr', title).should('exist')

    openRowMenu(title)
    clickMenuItem('Delete')
    confirmModal()

    // In place: deleteDeployment does not drop the row from the table's state
    // either, so the row going away is the page catching up.
    cy.contains('tr', title, {timeout: BASE_TIMEOUT * 2}).should('not.exist')

    visitDrafts()
    cy.contains('tr', title, {timeout: BASE_TIMEOUT * 2}).should('not.exist')
  })
})
