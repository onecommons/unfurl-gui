import {deploymentFixturePath} from '../../support/deployment-fixture'
describe('$TEST_NAME', () => {
  it('Can recreate deployment', () => {
    cy.recreateDeployment(deploymentFixturePath('$TEST_NAME'))
  })
})
