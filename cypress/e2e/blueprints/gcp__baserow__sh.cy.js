import {deploymentFixturePath} from '../../support/deployment-fixture'
describe('gcp__baserow__sh', () => {
  it('Can recreate deployment', () => {
    cy.recreateDeployment(deploymentFixturePath('gcp__baserow__sh'))
  })
})
