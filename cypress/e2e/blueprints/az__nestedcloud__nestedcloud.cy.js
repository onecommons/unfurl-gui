import {deploymentFixturePath} from '../../support/deployment-fixture'
describe('az__nestedcloud__nestedcloud', () => {
  it('Can recreate deployment', () => {
    cy.recreateDeployment(deploymentFixturePath('az__nestedcloud__nestedcloud'))
  })
})
