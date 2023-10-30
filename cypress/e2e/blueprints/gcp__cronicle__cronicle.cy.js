import {deploymentFixturePath} from '../../support/deployment-fixture'
describe('gcp__cronicle__cronicle', () => {
  it('Can recreate deployment', () => {
    cy.recreateDeployment(deploymentFixturePath('gcp__cronicle__cronicle'))
  })
})
