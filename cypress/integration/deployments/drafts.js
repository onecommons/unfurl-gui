const BASE_TIMEOUT = Cypress.env('BASE_TIMEOUT')

function deploymentName(baseTitle) {
  return `Cy ${baseTitle} ${Date.now().toString(36).slice(4) + Math.random().toString().slice(-4)}`
}

function mariaDBSaves(title, fixture) {
  cy.recreateDeployment({
    title,
    fixture,
    shouldSave: true
  })

  cy.wait(BASE_TIMEOUT / 2)
  cy.get('[data-testid="card-self-hosted-mariadb"]').should('exist')

  cy.get('[data-testid="tab-requirements-self-hosted-mariadb"]').click()
  cy.get('[data-testid="create-dependency-db-dockerhost.host"]').click()

  cy.get('[data-testid^="resource-selection-unfurl.nodes."]').click()

  cy.get('.modal-content').within(() => {
    cy.contains('button:visible', 'Next').click()
  })


  cy.contains('button:visible', 'Save').click()
  cy.wait(BASE_TIMEOUT / 2)

  cy.get('[data-testid="card-compute-for-self-hosted-mariadb"]').should('exist')
}

describe('Drafts', () => {
  it('Can retain dependencies', () => {
    const title = deploymentName('GCP Drafts Test')
    const fixture = 'generated/deployments/_production-gcp__ghost__mariadb-draft-gcp'
    mariaDBSaves(title, fixture)

    cy.get('[data-testid="tab-requirements-self-hosted-mariadb"]').should('exist')

    cy.get('[data-testid="delete-or-disconnect-the_app.db"]').click()

    cy.get('.modal-content').within(() => {
      cy.contains('button:visible', 'Remove').click()
    })

    cy.contains('button:visible', 'Save').click()
    cy.wait(BASE_TIMEOUT / 2)

    cy.get('[data-testid="create-dependency-the_app.db"]').click()

    cy.get('[data-testid="resource-selection-MariaDBInstance"]').click()
    cy.wait(100)

    cy.get('.modal-content').within(() => {
      cy.contains('button:visible', 'Next').click()
    })

    cy.contains('button:visible', 'Save').click()

    cy.wait(BASE_TIMEOUT / 2)
    cy.get('[data-testid="card-self-hosted-mariadb"]').should('exist')
    cy.get('[data-testid="tab-requirements-self-hosted-mariadb"]').should('exist')
  })
})
