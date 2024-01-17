import {deploymentFixturePath} from '../../support/deployment-fixture'
describe('k8s__wordpress__wordpress', () => {
  it('Can recreate deployment', () => {
    cy.recreateDeployment(deploymentFixturePath('k8s__wordpress__wordpress'))
  })
})
