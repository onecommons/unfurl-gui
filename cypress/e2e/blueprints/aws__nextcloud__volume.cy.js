import {deploymentFixturePath} from '../../support/deployment-fixture'
describe('aws__nextcloud__volume', () => {
  it('Can recreate deployment', () => {
    cy.recreateDeployment(deploymentFixturePath('aws__nextcloud__volume'))
  })
})
