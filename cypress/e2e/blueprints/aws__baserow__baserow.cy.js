import {deploymentFixturePath} from '../../support/deployment-fixture'
describe('aws__baserow__baserow', () => {
  it('Can recreate deployment', () => {
    cy.recreateDeployment(deploymentFixturePath('aws__baserow__baserow'))
  })
})
