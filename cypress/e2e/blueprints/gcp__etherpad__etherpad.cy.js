import {deploymentFixturePath} from '../../support/deployment-fixture'
describe('gcp__etherpad__etherpad', () => {
  it('Can recreate deployment', () => {
    cy.recreateDeployment(deploymentFixturePath('gcp__etherpad__etherpad'))
  })
})
