import {deploymentFixturePath} from '../../support/deployment-fixture'
describe('aws__minecraft__minecraft', () => {
  it('Can recreate deployment', () => {
    cy.recreateDeployment(deploymentFixturePath('aws__minecraft__minecraft'))
  })
})
