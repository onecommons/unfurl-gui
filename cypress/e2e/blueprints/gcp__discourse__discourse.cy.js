import {deploymentFixturePath} from '../../support/deployment-fixture'
describe('gcp__discourse__discourse', () => {
  it('Can recreate deployment', () => {
    cy.recreateDeployment(deploymentFixturePath('gcp__discourse__discourse'))
  })
})
