import {deploymentFixturePath} from '../../support/deployment-fixture'
describe('az__nextcloud__sh', () => {
  it('Can recreate deployment', () => {
    cy.recreateDeployment(deploymentFixturePath('az__nextcloud__sh'))
  })
})
