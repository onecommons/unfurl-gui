import {deploymentFixturePath} from '../../support/deployment-fixture'
describe('aws__wordpress__sh', () => {
  it('Can recreate deployment', () => {
    cy.recreateDeployment(deploymentFixturePath('aws__wordpress__sh'))
  })
})
