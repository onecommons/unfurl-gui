import {deploymentFixturePath} from '../../support/deployment-fixture'
describe('gcp__nextcloud__fullsh', () => {
  it('Can recreate deployment', () => {
    cy.recreateDeployment(deploymentFixturePath('gcp__nextcloud__fullsh'))
  })
})
