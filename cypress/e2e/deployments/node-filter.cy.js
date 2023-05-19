const BASE_TIMEOUT = Cypress.env('BASE_TIMEOUT')
const fixture = 'generated/deployments/_production-gcp__baserow__baserow-minimal'

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
    cy.get('[data-testid="oc-input-compute-mem_size"] input').invoke('val', '').type('1999')
    cy.get('[data-testid="oc-input-compute-mem_size"] input').blur()
    cy.contains('The field value cannot be less than 2000').should('be.visible')
    cy.get('[data-testid="deploy-button"]').should('be.disabled')
  }) 
})
