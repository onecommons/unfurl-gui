const DASHBOARD_DEST = Cypress.env('DASHBOARD_DEST')
const BASE_TIMEOUT = Cypress.env('BASE_TIMEOUT')

export function deploymentNames(...titles) {
  const descriminator =  Date.now().toString(36).slice(4) + Math.random().toString(36).slice(4)
  return titles.map(baseTitle => `Cy ${baseTitle} ${descriminator}`)
}


export function deploySharedVolume1(dep, fixture, cardTestId) {
  const subdomain = dep.split(' ').pop()
  cy.recreateDeployment({
    fixture,
    title: dep,
    skipTeardown: true,
    subdomain
  })

  cy.visit(`/${DASHBOARD_DEST}/-/deployments?show=running`)

  cy.contains("a", dep).click()


  cy.get(`[data-testid="${cardTestId}"]`).within(() => {
    cy.contains("button", "Share").scrollIntoView().click()
    cy.contains("button", "Share in current environment").click({force: true})
    cy.contains("button", "Shared").should('exist')
    cy.wait(BASE_TIMEOUT / 2)
  })

  cy.undeploy(dep)
}

export function deploySharedVolume2(dep1, dep2, fixture, cardTestId) {
  const subdomain = dep2.split(' ').pop()
  cy.recreateDeployment({
    fixture,
    title: dep2,
    expectExisting: true,
    subdomain
  })

  cy.visit(`/${DASHBOARD_DEST}/-/deployments`)

  cy.contains("a", dep1).click()

  cy.get(`[data-testid="${cardTestId}"]`).within(() => {
    cy.contains("button", "Shared").scrollIntoView().click()
    cy.contains("button", "Stop sharing").click()
    cy.contains("button", "Share").should('exist')
  })

}


