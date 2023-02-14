const BASE_URL = Cypress.env('OC_URL')
const USERNAME = Cypress.env('OC_IMPERSONATE')
const BASE_TIMEOUT = Cypress.env('BASE_TIMEOUT')

function deploymentName(baseTitle) {
  return `Cy ${baseTitle} ${Date.now().toString(36).slice(4) + Math.random().toString().slice(-4)}`
}

function deploySharedVolume(fixture, cardTestId) {
  let dep1 = deploymentName('Sharing'), dep2 = deploymentName('Borrowing')
  cy.recreateDeployment({
    fixture,
    title: dep1,
    skipTeardown: true
  })

  cy.visit(`${BASE_URL}/${USERNAME}/dashboard/-/deployments?show=running`)

  cy.contains("a", dep1).click()


  cy.get(`[data-testid="${cardTestId}"]`).within(() => {
    cy.contains("button", "Share").click()
    cy.contains("button", "Share in current environment").click()
  })

  cy.undeploy(dep1)

  cy.recreateDeployment({
    fixture,
    title: dep2,
    expectExisting: true
  })
}

describe('Shared volume', () => {
  it('Can deploy with shared volume (aws)', () => {
    const fixture = 'generated/deployments/_aws-20230131t192328579z__nextcloud__volume.json'
    const cardTestId = 'card-aws-elastic-block-storage-volume'

    deploySharedVolume(fixture, cardTestId)
  })

  it('Can deploy with shared volume (gcp)', () => {
    const fixture = 'generated/deployments/_gcp__nextcloud__volume.json'
    const cardTestId = 'card-google-cloud-compute-persistent-disk'

    deploySharedVolume(fixture, cardTestId)
  })
})
