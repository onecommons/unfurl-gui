// The deployments table's row controls stopped being a GlDropdown in 2a42534e,
// which moved them to GlDisclosureDropdown to fix menu positioning. Two things
// follow, and both broke the specs that opened this menu by hand:
//
//  - the toggle is `.gl-new-dropdown-toggle`, not `button.dropdown-toggle`
//  - the menu is positioned `fixed`, so its items are not inside the <tr> --
//    only the toggle can be addressed within the row
//
// GlDropdown still exists and other components still use it, so the old
// selector is not dead everywhere; it is dead for this menu.
function deploymentRowAction(deploymentTitle, label) {
  cy.contains('tr', deploymentTitle).within(() => {
    cy.get('.gl-new-dropdown-toggle').click()
  })

  cy.get('.gl-new-dropdown-panel:visible')
    .contains('.gl-new-dropdown-item', label)
    .click()
}

Cypress.Commands.add('deploymentRowAction', deploymentRowAction)
