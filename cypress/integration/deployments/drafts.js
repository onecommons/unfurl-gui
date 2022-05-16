
describe('Drafts', () => {
  it('Can retain dependencies', () => {
    cy.recreateDeployment({
      fixture: 'generated/deployments/_staging-aws__ghost__mariadb-draft',
      shouldSave: true
    })

    cy.go('back')

    cy.get('[data-testid="tab-requirements-self-hosted-mariadb"]').click()
  })
})
