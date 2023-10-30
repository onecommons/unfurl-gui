import {deploymentFixturePath} from '../../support/deployment-fixture'
describe('do__nextcloud__mail', () => {
  it('Can recreate deployment', () => {
    cy.recreateDeployment(deploymentFixturePath('do__nextcloud__mail'))
  })
})
