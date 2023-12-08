import {deploymentFixturePath} from '../../support/deployment-fixture'
const FIXTURE = deploymentFixturePath('aws__minecraft__minecraft')
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

describe('Multiple workflows', () => {
  it('Can run multiple deployments simultaneously', () => {
    const baseTitle = 'Simultaneous deployments'
    let dep1 = deploymentName(baseTitle), dep2 = deploymentName(baseTitle)
    cy.recreateDeployment({
      fixture: FIXTURE,
      shouldSave: true,
      title: dep1
    })

    cy.recreateDeployment({
      fixture: FIXTURE,
      shouldSave: true,
      title: dep2
    })

    cy.contains('Cancel Deployment').click()

    deployDraft(dep1)
    deployDraft(dep2)


    cy.waitUntil(() => {
      cy.visit(`/${NAMESPACE}/dashboard/-/deployments?show=running`)
      cy.get('.oc-table').first().should('exist')
      return cy.document().then($document => {
        let table = $document.querySelector('.oc-table')
        return table.textContent.includes(dep1) && table.textContent.includes(dep2)
      })
    }, {timeout: BASE_TIMEOUT * 30, interval: BASE_TIMEOUT * 3})

    cy.undeploy(dep1)
  })
})
