
function mariaDBSaves(fixture) {
  cy.recreateDeployment({
    fixture,
    shouldSave: true
  })

  cy.go('back')
  cy.get('[data-testid="tab-requirements-self-hosted-mariadb"]').click()

}

describe('Drafts', () => {
  it('Can retain dependencies', () => {
    mariaDBSaves('generated/deployments/_production-gcp__ghost__mariadb-draft-gcp')
    mariaDBSaves('generated/deployments/_staging-aws__ghost__mariadb-draft')
  })
})
