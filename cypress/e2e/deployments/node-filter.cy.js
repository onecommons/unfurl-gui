import {deploymentFixturePath} from '../../support/deployment-fixture'
const BASE_TIMEOUT = Cypress.env('BASE_TIMEOUT')
const fixture = deploymentFixturePath('aws__baserow__baserow')

function deploymentName(baseTitle) {
  return `Cy ${baseTitle} ${Date.now().toString(36).slice(4) + Math.random().toString().slice(-4)}`
}

describe('Node filter', () => {
  const title = deploymentName('nf')
  before(() => {
    cy.recreateDeployment({
      title,
      fixture,
      shouldSave: true
    })

    cy.wait(BASE_TIMEOUT / 2)
  })

  it('Can apply a min constraint', () => {
    const selector = ['ec2-instance', 'compute'].map(
      name => `[data-testid="oc-input-${name}-mem_size"] input`
    ).join(', ')
    cy.get(selector).invoke('val', '').type('1999')
    cy.get(selector).blur()
    cy.contains('The field value cannot be less than 2000').should('be.visible')
    cy.get('[data-testid="deploy-button"]').should('be.disabled')
  })
})
