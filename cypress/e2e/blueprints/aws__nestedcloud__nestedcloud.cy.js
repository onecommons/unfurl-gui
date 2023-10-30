import {deploymentFixturePath} from '../../support/deployment-fixture'
describe('aws__nestedcloud__nestedcloud', () => {
  it('Can recreate deployment', () => {
    cy.recreateDeployment(deploymentFixturePath('aws__nestedcloud__nestedcloud'))
  })
})
