import {deploymentFixturePath} from '../../support/deployment-fixture'

const TEST_VERSIONS = Cypress.env('TEST_VERSIONS')
const SKIP_NESTEDCLOUD = Cypress.env("SKIP_NESTEDCLOUD")

// TODO test fixture known to not work on v1
if(TEST_VERSIONS != 'v1' && !SKIP_NESTEDCLOUD) {
  describe('gcp__nestedcloud__nestedcloud', () => {
    it('Can recreate deployment', () => {
      cy.recreateDeployment(deploymentFixturePath('gcp__nestedcloud__nestedcloud'))
    })
  })
}
