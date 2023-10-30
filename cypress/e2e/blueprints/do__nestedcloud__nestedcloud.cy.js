import {deploymentFixturePath} from '../../support/deployment-fixture'
describe('do__nestedcloud__nestedcloud', () => {
  it('Can recreate deployment', () => {
    cy.recreateDeployment(deploymentFixturePath('do__nestedcloud__nestedcloud'))
  })
})
