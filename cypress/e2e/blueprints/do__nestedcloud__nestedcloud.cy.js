import {deploymentFixturePath} from '../../support/deployment-fixture'
const SKIP_NESTEDCLOUD = Cypress.env("SKIP_NESTEDCLOUD")
describe('do__nestedcloud__nestedcloud', () => {
  if(!SKIP_NESTEDCLOUD) {
    it('Can recreate deployment', () => {
      cy.recreateDeployment(deploymentFixturePath('do__nestedcloud__nestedcloud'))
    })
  }
})
