import {deploymentFixturePath} from '../../support/deployment-fixture'
describe('gcp__nestedcloud__nestedcloud', () => {
  it('Can recreate deployment', () => {
    cy.recreateDeployment(deploymentFixturePath('gcp__nestedcloud__nestedcloud'))
  })
})
