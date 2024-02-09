import {deploymentFixturePath} from '../../support/deployment-fixture'

const TEST_VERSIONS = Cypress.env('TEST_VERSIONS')

// There's no v1 fixture for this test
if(TEST_VERSIONS != 'v1') {
  describe('aws__nextcloud__floatingip', () => {
    it('Can recreate deployment', () => {
      cy.recreateDeployment(deploymentFixturePath('aws__nextcloud__floatingip'))
    })
  })
}
