const NAMESPACE = Cypress.env('DEFAULT_NAMESPACE')
const BASE_TIMEOUT = Cypress.env('BASE_TIMEOUT')

export function deploymentName(baseTitle) {
  return `Cy ${baseTitle} ${Date.now().toString(36).slice(4) + Math.random().toString().slice(-4)}`
}

export function deploySharedVolume1(dep, fixture, cardTestId) {
  cy.recreateDeployment({
    fixture,
    title: dep,
    skipTeardown: true
  })

  cy.visit(`/${NAMESPACE}/dashboard/-/deployments?show=running`)

  cy.contains("a", dep).click()


  cy.get(`[data-testid="${cardTestId}"]`).within(() => {
    cy.contains("button", "Share").click()
    cy.contains("button", "Share in current environment").click()
  })

  cy.undeploy(dep)
}

export function deploySharedVolume2(dep, fixture, cardTestId) {
  cy.recreateDeployment({
    fixture,
    title: dep,
    expectExisting: true
  })

  cy.visit(`/${NAMESPACE}/dashboard/-/deployments`)

  cy.contains("a", dep).click()

  cy.get(`[data-testid="${cardTestId}"]`).within(() => {
    cy.contains("button", "Shared").click()
    cy.contains("button", "Stop sharing").click()
  })

}

