import {deploymentFixturePath} from '../../support/deployment-fixture'
describe('gcp__memos__memos', () => {
  it('Can recreate deployment', () => {
    cy.recreateDeployment(deploymentFixturePath('gcp__memos__memos'))
  })
})
