const NAMESPACE = Cypress.env('DEFAULT_NAMESPACE')
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

  cy.visit(`/${NAMESPACE}/dashboard/-/deployments?show=running`)

  cy.contains("a", dep).click()


  cy.get(`[data-testid="${cardTestId}"]`).within(() => {
    cy.contains("button", "Share").click()
    cy.contains("button", "Share in current environment").click()
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

  cy.visit(`/${NAMESPACE}/dashboard/-/deployments`)

  cy.contains("a", dep1).click()

  cy.get(`[data-testid="${cardTestId}"]`).within(() => {
    cy.contains("button", "Shared").click()
    cy.contains("button", "Stop sharing").click()
  })

}


