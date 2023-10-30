import {deploymentFixturePath} from '../../support/deployment-fixture'
describe('gcp__ghost__ghost', () => {
  it('Can recreate deployment', () => {
    cy.recreateDeployment(deploymentFixturePath('gcp__ghost__ghost'))
  })
})
