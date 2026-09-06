import {deploymentFixturePath} from '../../support/deployment-fixture'

const SPEC = 'aws__container-webapp__dockerhub'
const NO_FLAKY = Cypress.env('NO_FLAKY')

if(!NO_FLAKY) {
  describe(SPEC, spec)
}

function spec() {
  it('Can recreate deployment', () => {
    cy.recreateDeployment({
      fixture: deploymentFixturePath(SPEC),
      verificationRoutine: 'default',
      afterRecreateDeployment() {
        cy.contains('a', 'Container').click()
        cy.get('[data-testid="oc-input-the_app-container.ports-add"]').click()
        cy.getInputOrTextarea('[data-testid="oc-input-the_app-container.ports-value"]').last().type('8080:80')

        cy.get('input[data-testid="oc-input-the_app-image"]').type('nginx:latest')

        cy.wait(500)
      }
    })
  })
}
