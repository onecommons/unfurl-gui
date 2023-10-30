import {deploymentFixturePath} from '../../support/deployment-fixture'
describe('gcp__cachet__cachet', () => {
  it('Can recreate deployment', () => {
    cy.recreateDeployment(deploymentFixturePath('gcp__cachet__cachet'))
  })
})
