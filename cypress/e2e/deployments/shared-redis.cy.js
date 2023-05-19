const FIXTURE = 'generated/deployments/_production-gcp__nextcloud__redis-mail-pg'
const USERNAME = Cypress.env('OC_IMPERSONATE')
const NAMESPACE = Cypress.env('DEFAULT_NAMESPACE')
const BASE_TIMEOUT = Cypress.env('BASE_TIMEOUT')

function deploymentName(baseTitle) {
  return `Cy ${baseTitle} ${Date.now().toString(36).slice(4) + Math.random().toString().slice(-4)}`
}


function deployDraft(draft) {
    cy.contains('a', 'Your Deployments').click()
    cy.contains('tr', draft).within(() => {
      cy.contains('Edit Draft').click()
    })
    cy.wait(BASE_TIMEOUT / 2)
    cy.get('[data-testid="deploy-button"]').click()
    cy.wait(BASE_TIMEOUT / 2)
    cy.go('back')
}

describe('Shared redis', () => {
  it('Can deploy with shared redis instance', () => {
    let dep1 = deploymentName('Sharing'), dep2 = deploymentName('Borrowing')
    cy.recreateDeployment({
      fixture: FIXTURE,
      title: dep1,
      skipTeardown: true
    })

    cy.visit(`/${NAMESPACE}/dashboard/-/deployments?show=running`)

    cy.contains("a", dep1).click()


    cy.get('[data-testid="card-self-hosted-redis"]').within(() => {
      cy.contains("button", "Share").click()
      cy.contains("button", "Share in current environment").click()
    })

    cy.recreateDeployment({
      fixture: FIXTURE,
      title: dep2
    })

    cy.undeploy(dep1)
  })
})
