import {deploymentFixturePath} from '../../support/deployment-fixture'
describe('gcp__minecraft__minecraft', () => {
  it('Can recreate deployment', () => {
    cy.recreateDeployment(deploymentFixturePath('gcp__minecraft__minecraft'))
  })
})
