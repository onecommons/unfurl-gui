import {deploymentFixturePath} from '../../support/deployment-fixture'
describe('gcp__openvscode-server__openvscode-server', () => {
  it('Can recreate deployment', () => {
    cy.recreateDeployment(deploymentFixturePath('gcp__openvscode-server__openvscode-server'))
  })
})
